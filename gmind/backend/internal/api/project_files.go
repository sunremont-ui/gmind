package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/project"
)

type createProjectFileRequest struct {
	Root       string `json:"root"`
	WorkbookID string `json:"workbook_id"`
	Directory  string `json:"directory"`
	Name       string `json:"name"`
}

type deleteProjectFileRequest struct {
	Root       string `json:"root"`
	WorkbookID string `json:"workbook_id"`
	Path       string `json:"path"`
}

// CreateProjectFile — POST /api/v1/projects/files.
// Создаёт новый Markdown-документ внутри открытого корня и сразу пересобирает
// сохранённую карту проекта. Существующие файлы намеренно не перезаписываются.
func (h *Handler) CreateProjectFile(w http.ResponseWriter, r *http.Request) {
	var req createProjectFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	wb, root, err := h.projectWorkbook(req.WorkbookID, req.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	directory := strings.TrimSpace(req.Directory)
	if directory == "" {
		directory = root
	}
	directory, err = canonicalExistingPath(directory)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad directory: "+err.Error())
		return
	}
	info, err := os.Stat(directory)
	if err != nil || !info.IsDir() {
		writeError(w, http.StatusBadRequest, "directory does not exist")
		return
	}
	if !pathInsideRoot(root, directory) {
		writeError(w, http.StatusBadRequest, "directory must stay inside the project root")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" || name == "." || name == ".." || filepath.Base(name) != name || strings.ContainsAny(name, `/\:`) {
		writeError(w, http.StatusBadRequest, "file name must not contain a path")
		return
	}
	if filepath.Ext(name) == "" {
		name += ".md"
	}
	ext := strings.ToLower(filepath.Ext(name))
	if ext != ".md" && ext != ".markdown" {
		writeError(w, http.StatusBadRequest, "only .md/.markdown files can be created")
		return
	}

	full := filepath.Join(directory, name)
	title := strings.TrimSpace(strings.TrimSuffix(name, filepath.Ext(name)))
	if title == "" {
		writeError(w, http.StatusBadRequest, "file name is required")
		return
	}
	f, err := os.OpenFile(full, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		if os.IsExist(err) {
			writeError(w, http.StatusConflict, "file already exists")
			return
		}
		writeError(w, http.StatusBadRequest, "cannot create file: "+err.Error())
		return
	}
	if _, err := f.WriteString("# " + title + "\n"); err != nil {
		_ = f.Close()
		_ = os.Remove(full)
		internalError(w, err)
		return
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(full)
		internalError(w, err)
		return
	}

	if err := h.refreshProjectWorkbook(wb, root); err != nil {
		_ = os.Remove(full)
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"path": full, "workbook": wb})
}

// DeleteProjectFile — DELETE /api/v1/projects/files.
// Удаление ограничено документами дерева внутри открытого корня. Связанные с
// удалённым файлом временные workbook-представления также удаляются.
func (h *Handler) DeleteProjectFile(w http.ResponseWriter, r *http.Request) {
	var req deleteProjectFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	wb, root, err := h.projectWorkbook(req.WorkbookID, req.Root)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	target, err := canonicalExistingPath(req.Path)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "file not found")
			return
		}
		writeError(w, http.StatusBadRequest, "bad file path: "+err.Error())
		return
	}
	if !pathInsideRoot(root, target) || target == root {
		writeError(w, http.StatusBadRequest, "file must stay inside the project root")
		return
	}
	if _, supported := project.DocExtensions[strings.ToLower(filepath.Ext(target))]; !supported {
		writeError(w, http.StatusBadRequest, "only project documents can be deleted")
		return
	}
	info, err := os.Stat(target)
	if err != nil || info.IsDir() {
		writeError(w, http.StatusBadRequest, "path is not a file")
		return
	}
	backup, err := os.ReadFile(target)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read file: "+err.Error())
		return
	}
	mode := info.Mode().Perm()
	linkedWorkbookIDs := h.projectDocumentWorkbookIDs(target, wb.ID)
	if err := os.Remove(target); err != nil {
		writeError(w, http.StatusBadRequest, "cannot delete file: "+err.Error())
		return
	}
	if err := h.refreshProjectWorkbook(wb, root); err != nil {
		_ = os.WriteFile(target, backup, mode)
		internalError(w, err)
		return
	}

	deletedWorkbookIDs := make([]string, 0, len(linkedWorkbookIDs))
	for _, id := range linkedWorkbookIDs {
		if err := h.store.DeleteWorkbook(id); err == nil {
			deletedWorkbookIDs = append(deletedWorkbookIDs, id)
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"path":                 target,
		"workbook":             wb,
		"deleted_workbook_ids": deletedWorkbookIDs,
	})
}

func (h *Handler) projectWorkbook(workbookID, requestedRoot string) (*model.Workbook, string, error) {
	workbookID = strings.TrimSpace(workbookID)
	if workbookID == "" {
		return nil, "", fmt.Errorf("workbook_id is required")
	}
	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		return nil, "", err
	}
	if wb == nil {
		return nil, "", fmt.Errorf("project workbook not found")
	}
	root, err := canonicalExistingPath(requestedRoot)
	if err != nil {
		return nil, "", fmt.Errorf("bad project root: %w", err)
	}
	info, err := os.Stat(root)
	if err != nil || !info.IsDir() {
		return nil, "", fmt.Errorf("project root is not a directory")
	}
	workbookRoot, err := canonicalExistingPath(wb.SourcePath)
	if err != nil || !sameFilesystemPath(workbookRoot, root) {
		return nil, "", fmt.Errorf("workbook is not linked to this project root")
	}
	return wb, root, nil
}

func (h *Handler) refreshProjectWorkbook(wb *model.Workbook, root string) error {
	topic, _, err := project.Scan(root, project.Options{})
	if err != nil {
		return err
	}
	if len(wb.Sheets) == 0 {
		wb.AddSheet(model.NewSheet(topic.Title))
	}
	wb.Sheets[0].RootTopic = topic
	wb.SourcePath = root
	return h.store.UpdateWorkbook(wb)
}

func canonicalExistingPath(value string) (string, error) {
	abs, err := filepath.Abs(strings.TrimSpace(value))
	if err != nil {
		return "", err
	}
	return filepath.EvalSymlinks(abs)
}

func pathInsideRoot(root, target string) bool {
	rel, err := filepath.Rel(root, target)
	if err != nil || filepath.IsAbs(rel) {
		return false
	}
	return rel == "." || (rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)))
}

func sameFilesystemPath(left, right string) bool {
	return strings.EqualFold(filepath.Clean(left), filepath.Clean(right))
}

func (h *Handler) projectDocumentWorkbookIDs(target, rootWorkbookID string) []string {
	all, err := h.store.ListWorkbooks()
	if err != nil {
		return nil
	}
	ids := make([]string, 0, 1)
	for _, candidate := range all {
		if candidate.ID == rootWorkbookID || strings.TrimSpace(candidate.SourcePath) == "" {
			continue
		}
		candidatePath, err := canonicalExistingPath(candidate.SourcePath)
		if err == nil && sameFilesystemPath(candidatePath, target) {
			ids = append(ids, candidate.ID)
		}
	}
	return ids
}
