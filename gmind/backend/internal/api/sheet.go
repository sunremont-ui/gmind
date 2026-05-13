package api

import (
	"encoding/json"
	"net/http"

	"github.com/gmind/backend/internal/model"
	"github.com/go-chi/chi/v5"
)

func (h *Handler) CreateSheet(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateSheetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		req.Title = "New Sheet"
	}

	sheet := model.NewSheet(req.Title)
	wb.AddSheet(sheet)

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, sheet)
}

func (h *Handler) UpdateSheet(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	sheetID := chi.URLParam(r, "sheetID")

	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	sheet := wb.GetSheet(sheetID)
	if sheet == nil {
		writeError(w, http.StatusNotFound, "sheet not found")
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if title, ok := updates["title"].(string); ok {
		sheet.Title = title
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, sheet)
}

func (h *Handler) DeleteSheet(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	sheetID := chi.URLParam(r, "sheetID")

	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	wb.RemoveSheet(sheetID)

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
