package api

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gmind/backend/internal/model"
	"github.com/go-chi/chi/v5"
)

func (h *Handler) ListWorkbooks(w http.ResponseWriter, r *http.Request) {
	workbooks, err := h.store.ListWorkbooks()
	if err != nil {
		internalError(w, err)
		return
	}
	if workbooks == nil {
		workbooks = []*model.Workbook{}
	}
	writeJSON(w, http.StatusOK, workbooks)
}

func (h *Handler) CreateWorkbook(w http.ResponseWriter, r *http.Request) {
	var req model.CreateWorkbookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		req.Title = "Untitled Mind Map"
	}

	wb := model.NewWorkbook(req.Title)
	sheet := model.NewSheet("Central Topic")
	wb.AddSheet(sheet)

	if err := h.store.CreateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, wb)
}

func (h *Handler) GetWorkbook(w http.ResponseWriter, r *http.Request) {
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
	writeJSON(w, http.StatusOK, wb)
}

func (h *Handler) UpdateWorkbook(w http.ResponseWriter, r *http.Request) {
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

	body, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read body")
		return
	}

	// Try full workbook restore first (for undo/redo)
	var fullRestore model.Workbook
	if err := json.Unmarshal(body, &fullRestore); err == nil && fullRestore.ID != "" {
		wb.Title = fullRestore.Title
		wb.Private = fullRestore.Private
		wb.OwnerID = fullRestore.OwnerID
		wb.Sheets = fullRestore.Sheets
	} else {
		// Fallback: partial update
		var updates map[string]interface{}
		if err := json.Unmarshal(body, &updates); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		if title, ok := updates["title"].(string); ok {
			wb.Title = title
		}
		if priv, ok := updates["private"].(bool); ok {
			wb.Private = priv
		}
		if accessMode, ok := updates["access_mode"].(string); ok {
			wb.AccessMode = accessMode
		}
		if ownerID, ok := updates["owner_id"].(string); ok {
			wb.OwnerID = ownerID
		}
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, wb)
}

func (h *Handler) AddCollaborator(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	var req model.AddCollaboratorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.UserID == "" {
		writeError(w, http.StatusBadRequest, "user_id is required")
		return
	}
	if req.Role == "" {
		req.Role = "editor"
	}

	if err := h.store.AddCollaborator(workbookID, req.UserID, req.Role); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "added"})
}

func (h *Handler) RemoveCollaborator(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	userID := chi.URLParam(r, "userID")
	if userID == "" {
		writeError(w, http.StatusBadRequest, "user_id is required")
		return
	}

	if err := h.store.RemoveCollaborator(workbookID, userID); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

func (h *Handler) ListCollaborators(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	users, err := h.store.GetCollaborators(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if users == nil {
		users = []string{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"users": users})
}

func readBody(r *http.Request) ([]byte, error) {
	defer r.Body.Close()
	var buf bytes.Buffer
	if _, err := io.Copy(&buf, r.Body); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (h *Handler) ImportJSONData(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	body, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "cannot read body")
		return
	}

	var req struct {
		SheetID string `json:"sheet_id"`
		Data    string `json:"data"`
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	sheet := wb.GetSheet(req.SheetID)
	if sheet == nil {
		writeError(w, http.StatusNotFound, "sheet not found")
		return
	}

	sheet.ImportedData = req.Data

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "imported"})
}

func (h *Handler) ClearImportedData(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	var req struct {
		SheetID string `json:"sheet_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	sheet := wb.GetSheet(req.SheetID)
	if sheet == nil {
		writeError(w, http.StatusNotFound, "sheet not found")
		return
	}

	sheet.ImportedData = ""

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "cleared"})
}

func (h *Handler) DeleteWorkbook(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "workbookID")
	if err := h.store.DeleteWorkbook(id); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
