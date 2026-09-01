package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/gmind/backend/internal/markdown"
	"github.com/gmind/backend/internal/model"
	"github.com/go-chi/chi/v5"
)

// Markdown-файлы как рабочий формат: карта может быть связана с .md на диске,
// открываться из него и сохраняться обратно. Vault — каталог по умолчанию,
// но открыть/сохранить можно любой .md-файл (бэкенд слушает только localhost).

const maxMarkdownBytes = 20 << 20 // 20 MB

// mdRoot — каталог Markdown-хранилища по умолчанию.
func (h *Handler) mdRoot() string {
	if h.markdownPath != "" {
		return h.markdownPath
	}
	return "."
}

// resolveMarkdownPath приводит путь к абсолютному и проверяет расширение.
// Относительный путь считается путём внутри vault-каталога.
func (h *Handler) resolveMarkdownPath(p string) (string, error) {
	p = strings.TrimSpace(p)
	if p == "" {
		return "", fmt.Errorf("path is required")
	}
	if !filepath.IsAbs(p) {
		p = filepath.Join(h.mdRoot(), p)
	}
	p = filepath.Clean(p)
	ext := strings.ToLower(filepath.Ext(p))
	if ext != ".md" && ext != ".markdown" {
		return "", fmt.Errorf("only .md/.markdown files are supported")
	}
	return p, nil
}

type MarkdownFileInfo struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
	Dir      bool   `json:"dir"`
}

// ListMarkdownFiles — GET /api/v1/md/files?dir=...
// Возвращает подкаталоги и .md-файлы каталога (по умолчанию — vault).
func (h *Handler) ListMarkdownFiles(w http.ResponseWriter, r *http.Request) {
	dir := strings.TrimSpace(r.URL.Query().Get("dir"))
	if dir == "" {
		dir = h.mdRoot()
	}
	if !filepath.IsAbs(dir) {
		dir = filepath.Join(h.mdRoot(), dir)
	}
	dir = filepath.Clean(dir)

	// Vault создаём лениво: пустой каталог — нормальный первый запуск.
	if dir == filepath.Clean(h.mdRoot()) {
		_ = os.MkdirAll(dir, 0o755)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read directory: "+err.Error())
		return
	}

	files := make([]MarkdownFileInfo, 0, len(entries))
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		full := filepath.Join(dir, name)
		if e.IsDir() {
			files = append(files, MarkdownFileInfo{Name: name, Path: full, Dir: true})
			continue
		}
		ext := strings.ToLower(filepath.Ext(name))
		if ext != ".md" && ext != ".markdown" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		files = append(files, MarkdownFileInfo{
			Name:     name,
			Path:     full,
			Size:     info.Size(),
			Modified: info.ModTime().UTC().Format(time.RFC3339),
		})
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].Dir != files[j].Dir {
			return files[i].Dir
		}
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	writeJSON(w, http.StatusOK, map[string]any{"dir": dir, "root": h.mdRoot(), "files": files})
}

type openMarkdownRequest struct {
	Path string `json:"path"`
	// Reuse: если карта для этого файла уже открыта — вернуть её, а не плодить копии.
	Reuse bool `json:"reuse,omitempty"`
}

// OpenMarkdownFile — POST /api/v1/md/open {path}
// Читает .md с диска и создаёт связанную с ним карту.
func (h *Handler) OpenMarkdownFile(w http.ResponseWriter, r *http.Request) {
	var req openMarkdownRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	path, err := h.resolveMarkdownPath(req.Path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "file not found: "+path)
			return
		}
		writeError(w, http.StatusBadRequest, "cannot read file: "+err.Error())
		return
	}
	if len(data) > maxMarkdownBytes {
		writeError(w, http.StatusRequestEntityTooLarge, "file too large")
		return
	}

	if req.Reuse {
		if wb := h.findWorkbookBySourcePath(path); wb != nil {
			h.replaceRootFromMarkdown(wb, string(data), path)
			if err := h.store.UpdateWorkbook(wb); err != nil {
				internalError(w, err)
				return
			}
			writeJSON(w, http.StatusOK, wb)
			return
		}
	}

	title := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	wb := workbookFromMarkdown(string(data), title)
	wb.SourcePath = path
	wb.SourceSyncedAt = time.Now().UTC().Format(time.RFC3339)

	if err := h.store.CreateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, wb)
}

type importMarkdownRequest struct {
	Content string `json:"content"`
	Title   string `json:"title,omitempty"`
	// Path — необязательная привязка к файлу (карта потом сохраняется в него).
	Path string `json:"path,omitempty"`
}

// ImportMarkdown — POST /api/v1/workbooks/import/markdown
// Принимает JSON {content,title}, multipart-файл или сырой text/markdown.
func (h *Handler) ImportMarkdown(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxMarkdownBytes)

	var content, title, path string
	ct := r.Header.Get("Content-Type")

	switch {
	case strings.Contains(ct, "multipart/form-data"):
		if err := r.ParseMultipartForm(maxMarkdownBytes); err != nil {
			writeError(w, http.StatusBadRequest, "failed to parse multipart form: "+err.Error())
			return
		}
		file, hdr, err := r.FormFile("file")
		if err != nil {
			writeError(w, http.StatusBadRequest, "missing file field: "+err.Error())
			return
		}
		defer file.Close()
		data, err := io.ReadAll(file)
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to read file")
			return
		}
		content = string(data)
		title = r.FormValue("title")
		if title == "" && hdr != nil {
			title = strings.TrimSuffix(hdr.Filename, filepath.Ext(hdr.Filename))
		}
	case strings.Contains(ct, "application/json"):
		var req importMarkdownRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		content, title, path = req.Content, req.Title, req.Path
	default:
		data, err := io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to read body")
			return
		}
		content = string(data)
	}

	if strings.TrimSpace(content) == "" {
		writeError(w, http.StatusBadRequest, "empty markdown")
		return
	}
	if title == "" {
		title = "Imported Markdown"
	}

	wb := workbookFromMarkdown(content, title)
	if path != "" {
		resolved, err := h.resolveMarkdownPath(path)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		wb.SourcePath = resolved
	}
	if err := h.store.CreateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, wb)
}

type saveMarkdownRequest struct {
	// Path — «Сохранить как». Пусто → пишем в уже связанный файл.
	Path string `json:"path,omitempty"`
	// SheetID — какой лист выгружать; пусто → первый.
	SheetID string `json:"sheet_id,omitempty"`
}

// SaveWorkbookMarkdown — POST /api/v1/workbooks/{workbookID}/md/save
// Пишет карту в связанный .md-файл (или в указанный путь, связывая карту с ним).
func (h *Handler) SaveWorkbookMarkdown(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "workbookID")
	wb, err := h.store.GetWorkbook(id)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	var req saveMarkdownRequest
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req) // тело не обязательно
	}

	target := req.Path
	if target == "" {
		target = wb.SourcePath
	}
	if target == "" {
		// Ни привязки, ни явного пути — кладём в vault под именем карты.
		target = filepath.Join(h.mdRoot(), sanitizeFilename(wb.Title)+".md")
	}
	path, err := h.resolveMarkdownPath(target)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if len(wb.Sheets) == 0 {
		writeError(w, http.StatusBadRequest, "workbook has no sheets")
		return
	}
	sheet := wb.Sheets[0]
	if req.SheetID != "" {
		if s := wb.GetSheet(req.SheetID); s != nil {
			sheet = s
		}
	}
	if sheet == nil || sheet.RootTopic == nil {
		writeError(w, http.StatusBadRequest, "sheet has no root topic")
		return
	}

	content := markdown.Render(sheet.RootTopic)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		internalError(w, err)
		return
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		writeError(w, http.StatusBadRequest, "cannot write file: "+err.Error())
		return
	}

	wb.SourcePath = path
	wb.SourceSyncedAt = time.Now().UTC().Format(time.RFC3339)
	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"path":      path,
		"bytes":     len(content),
		"synced_at": wb.SourceSyncedAt,
	})
}

// ReloadWorkbookMarkdown — POST /api/v1/workbooks/{workbookID}/md/reload
// Перечитывает связанный файл с диска, заменяя содержимое карты.
func (h *Handler) ReloadWorkbookMarkdown(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "workbookID")
	wb, err := h.store.GetWorkbook(id)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}
	if wb.SourcePath == "" {
		writeError(w, http.StatusBadRequest, "workbook is not linked to a markdown file")
		return
	}
	data, err := os.ReadFile(wb.SourcePath)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read file: "+err.Error())
		return
	}
	h.replaceRootFromMarkdown(wb, string(data), wb.SourcePath)
	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, wb)
}

// ─────────────────────── helpers ───────────────────────

func workbookFromMarkdown(content, title string) *model.Workbook {
	root := markdown.Parse(content, title)
	wb := model.NewWorkbook(title)
	sheet := model.NewSheet(root.Title)
	sheet.RootTopic = root
	wb.AddSheet(sheet)
	return wb
}

func (h *Handler) replaceRootFromMarkdown(wb *model.Workbook, content, path string) {
	root := markdown.Parse(content, wb.Title)
	if len(wb.Sheets) == 0 {
		wb.AddSheet(model.NewSheet(root.Title))
	}
	wb.Sheets[0].RootTopic = root
	wb.SourcePath = path
	wb.SourceSyncedAt = time.Now().UTC().Format(time.RFC3339)
}

func (h *Handler) findWorkbookBySourcePath(path string) *model.Workbook {
	all, err := h.store.ListWorkbooks()
	if err != nil {
		return nil
	}
	for _, wb := range all {
		if wb.SourcePath == path {
			full, err := h.store.GetWorkbook(wb.ID)
			if err == nil && full != nil {
				return full
			}
			return wb
		}
	}
	return nil
}
