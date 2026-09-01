package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gmind/backend/internal/project"
	"github.com/gmind/backend/internal/xmind"
)

// Схема проекта: каталог на диске → карта. Бэкенд слушает localhost, поэтому
// путь принимается любой абсолютный — это тот же уровень доверия, что у
// открытия .md-файла с диска.

type projectScanRequest struct {
	Path  string `json:"path"`
	Title string `json:"title,omitempty"`
	project.Options
}

func decodeProjectRequest(r *http.Request) (projectScanRequest, error) {
	var req projectScanRequest
	if r.Method == http.MethodGet {
		q := r.URL.Query()
		req.Path = q.Get("path")
		req.Title = q.Get("title")
		req.DocsOnly = q.Get("docs_only") == "1" || q.Get("docs_only") == "true"
		req.IncludeHidden = q.Get("include_hidden") == "1" || q.Get("include_hidden") == "true"
		if v, err := strconv.Atoi(q.Get("max_depth")); err == nil {
			req.MaxDepth = v
		}
		if v, err := strconv.Atoi(q.Get("max_nodes")); err == nil {
			req.MaxNodes = v
		}
		if ignore := strings.TrimSpace(q.Get("ignore")); ignore != "" {
			req.Ignore = strings.Split(ignore, ",")
		}
		return req, nil
	}
	err := json.NewDecoder(r.Body).Decode(&req)
	return req, err
}

// ScanProject — GET/POST /api/v1/projects/scan
// Считает схему, но ничего не сохраняет: панель показывает сводку до импорта.
func (h *Handler) ScanProject(w http.ResponseWriter, r *http.Request) {
	req, err := decodeProjectRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	root, stats, err := project.Scan(req.Path, req.Options)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"path":  root.Notes,
		"title": root.Title,
		"stats": stats,
		"root":  root,
	})
}

// ImportProject — POST /api/v1/projects/import
// Строит карту по каталогу и сохраняет её книгой: проект сразу открывается.
func (h *Handler) ImportProject(w http.ResponseWriter, r *http.Request) {
	req, err := decodeProjectRequest(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	wb, stats, err := project.ScanWorkbook(req.Path, req.Title, req.Options)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	// Книга помнит, из какого каталога построена: карту можно пересобрать.
	if len(wb.Sheets) > 0 && wb.Sheets[0].RootTopic != nil {
		wb.SourcePath = wb.Sheets[0].RootTopic.Notes
	}
	if err := h.store.CreateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"workbook": wb, "stats": stats})
}

type openDocRequest struct {
	Path string `json:"path"`
	// Reuse: если карта для этого файла уже открыта — вернуть её, а не плодить копии.
	Reuse bool `json:"reuse,omitempty"`
}

// OpenProjectDoc — POST /api/v1/projects/open-doc {path}
// Открывает документ из схемы проекта как карту. Оба поддерживаемых формата
// приходят сюда: узел схемы не знает, чем именно он подписан, он знает путь.
func (h *Handler) OpenProjectDoc(w http.ResponseWriter, r *http.Request) {
	var req openDocRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	path := strings.TrimSpace(req.Path)
	if path == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad path: "+err.Error())
		return
	}
	ext := strings.ToLower(filepath.Ext(abs))
	data, err := os.ReadFile(abs)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "file not found: "+abs)
			return
		}
		writeError(w, http.StatusBadRequest, "cannot read file: "+err.Error())
		return
	}

	switch ext {
	case ".md", ".markdown":
		if len(data) > maxMarkdownBytes {
			writeError(w, http.StatusRequestEntityTooLarge, "file too large")
			return
		}
		if req.Reuse {
			if wb := h.findWorkbookBySourcePath(abs); wb != nil {
				h.replaceRootFromMarkdown(wb, string(data), abs)
				if err := h.store.UpdateWorkbook(wb); err != nil {
					internalError(w, err)
					return
				}
				writeJSON(w, http.StatusOK, wb)
				return
			}
		}
		title := strings.TrimSuffix(filepath.Base(abs), filepath.Ext(abs))
		wb := workbookFromMarkdown(string(data), title)
		wb.SourcePath = abs
		wb.SourceSyncedAt = time.Now().UTC().Format(time.RFC3339)
		if err := h.store.CreateWorkbook(wb); err != nil {
			internalError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, wb)

	case ".xmind":
		sheets, err := xmind.ParseXMind(data)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid .xmind file: "+err.Error())
			return
		}
		title := strings.TrimSuffix(filepath.Base(abs), filepath.Ext(abs))
		if len(sheets) > 0 && sheets[0].Title != "" {
			title = sheets[0].Title
		}
		wb := xmind.ConvertToWorkbook(sheets, title)
		// Путь запоминаем так же, как у .md: карта знает, откуда пришла.
		wb.SourcePath = abs
		wb.SourceSyncedAt = time.Now().UTC().Format(time.RFC3339)
		if err := h.store.CreateWorkbook(wb); err != nil {
			internalError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, wb)

	default:
		writeError(w, http.StatusBadRequest, "only .md/.markdown and .xmind files can be opened as a map")
	}
}

type projectDirEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Dir  bool   `json:"dir"`
}

// BrowseProjectDirs — GET /api/v1/projects/dirs?path=...
// Список подкаталогов: панель даёт выбрать проект кликами, а не вводом пути
// вручную (диалог выбора папки в браузере недоступен).
func (h *Handler) BrowseProjectDirs(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimSpace(r.URL.Query().Get("path"))
	if path == "" {
		path = h.mdRoot()
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad path: "+err.Error())
		return
	}
	entries, err := os.ReadDir(abs)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read directory: "+err.Error())
		return
	}
	dirs := make([]projectDirEntry, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		dirs = append(dirs, projectDirEntry{Name: e.Name(), Path: filepath.Join(abs, e.Name()), Dir: true})
	}
	sort.Slice(dirs, func(i, j int) bool {
		return strings.ToLower(dirs[i].Name) < strings.ToLower(dirs[j].Name)
	})
	parent := filepath.Dir(abs)
	if parent == abs {
		parent = ""
	}
	writeJSON(w, http.StatusOK, map[string]any{"path": abs, "parent": parent, "dirs": dirs})
}
