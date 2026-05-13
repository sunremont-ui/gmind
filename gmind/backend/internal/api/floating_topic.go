package api

import (
	"encoding/json"
	"net/http"

	"github.com/gmind/backend/internal/model"
	"github.com/go-chi/chi/v5"
)

func (h *Handler) CreateFloatingTopic(w http.ResponseWriter, r *http.Request) {
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
		Title string          `json:"title"`
		Pos   *model.Position `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	topic := model.NewTopic(req.Title)
	if req.Pos != nil {
		topic.Position = req.Pos
	} else {
		topic.Position = model.NewPosition(200, 200)
	}

	sheetID := chi.URLParam(r, "sheetID")
	if sheetID == "" {
		sheetID = wb.Sheets[0].ID
	}
	sheet := wb.GetSheet(sheetID)
	if sheet == nil {
		writeError(w, http.StatusNotFound, "sheet not found")
		return
	}

	sheet.AddFloatingTopic(topic)

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, topic)
}

func (h *Handler) UpdateFloatingTopic(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	topicID := chi.URLParam(r, "topicID")

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
		Title    string          `json:"title,omitempty"`
		Position *model.Position `json:"position,omitempty"`
		Icon     string          `json:"icon,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	found := false
	for _, sheet := range wb.Sheets {
		for _, ft := range sheet.FloatingTopics {
			if ft.ID == topicID {
				if req.Title != "" {
					ft.Title = req.Title
				}
				if req.Position != nil {
					ft.Position = req.Position
				}
				if req.Icon != "" {
					ft.Icon = req.Icon
				}
				found = true
				break
			}
		}
		if found {
			break
		}
	}

	if !found {
		writeError(w, http.StatusNotFound, "floating topic not found")
		return
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) DeleteFloatingTopic(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	topicID := chi.URLParam(r, "topicID")

	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	found := false
	for _, sheet := range wb.Sheets {
		if sheet.RemoveFloatingTopic(topicID) {
			found = true
			break
		}
	}

	if !found {
		writeError(w, http.StatusNotFound, "floating topic not found")
		return
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
