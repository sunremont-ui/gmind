package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

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

	// Enrich topics with comment counts.
	var topicIDs []string
	for _, sheet := range wb.Sheets {
		if sheet.RootTopic != nil {
			collectTopicIDs(sheet.RootTopic, &topicIDs)
		}
		for _, ft := range sheet.FloatingTopics {
			collectTopicIDs(ft, &topicIDs)
		}
	}
	if len(topicIDs) > 0 {
		counts, err := h.store.CommentStore().CountsByTopics(topicIDs)
		if err == nil && len(counts) > 0 {
			for _, sheet := range wb.Sheets {
				if sheet.RootTopic != nil {
					applyCommentCounts(sheet.RootTopic, counts)
				}
				for _, ft := range sheet.FloatingTopics {
					applyCommentCounts(ft, counts)
				}
			}
		}
	}

	// V5.0 backward compat: embed relationships from new table into Sheet.Relationships JSON
	h.EmbedRelationshipsIntoSheet(wb)

	writeJSON(w, http.StatusOK, wb)
}

func collectTopicIDs(t *model.Topic, ids *[]string) {
	if t == nil {
		return
	}
	*ids = append(*ids, t.ID)
	for _, c := range t.Children {
		collectTopicIDs(c, ids)
	}
}

func applyCommentCounts(t *model.Topic, counts map[string]int) {
	if t == nil {
		return
	}
	t.CommentCount = counts[t.ID]
	for _, c := range t.Children {
		applyCommentCounts(c, counts)
	}
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

func (h *Handler) ExportMarkdown(w http.ResponseWriter, r *http.Request) {
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

	var sb strings.Builder
	if len(wb.Sheets) > 0 {
		topicToMarkdown(&sb, wb.Sheets[0].RootTopic, 0)
	}

	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+sanitizeFilename(wb.Title)+`.md"`)
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, sb.String())
}

func topicToMarkdown(sb *strings.Builder, t *model.Topic, depth int) {
	if t == nil {
		return
	}
	switch depth {
	case 0:
		fmt.Fprintf(sb, "# %s\n\n", t.Title)
	case 1:
		fmt.Fprintf(sb, "## %s\n\n", t.Title)
	case 2:
		fmt.Fprintf(sb, "### %s\n\n", t.Title)
	default:
		fmt.Fprintf(sb, "%s- %s\n", strings.Repeat("  ", depth-3), t.Title)
	}
	if t.Notes != "" {
		fmt.Fprintf(sb, "> %s\n\n", t.Notes)
	}
	for _, child := range t.Children {
		topicToMarkdown(sb, child, depth+1)
	}
}

func (h *Handler) ExportFreeMind(w http.ResponseWriter, r *http.Request) {
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

	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	sb.WriteString(`<map version="1.0.1">` + "\n")
	if len(wb.Sheets) > 0 && wb.Sheets[0].RootTopic != nil {
		topicToFreeMind(&sb, wb.Sheets[0].RootTopic, 1)
	}
	sb.WriteString("</map>\n")

	w.Header().Set("Content-Type", "application/x-freemind; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="`+sanitizeFilename(wb.Title)+`.mm"`)
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, sb.String())
}

func topicToFreeMind(sb *strings.Builder, t *model.Topic, indent int) {
	if t == nil {
		return
	}
	pad := strings.Repeat("  ", indent)
	if len(t.Children) == 0 {
		fmt.Fprintf(sb, `%s<node TEXT=%q/>`+"\n", pad, escapeXMLAttr(t.Title))
		return
	}
	fmt.Fprintf(sb, `%s<node TEXT=%q>`+"\n", pad, escapeXMLAttr(t.Title))
	if t.Notes != "" {
		fmt.Fprintf(sb, `%s  <richcontent TYPE="NOTE"><html><body><p>%s</p></body></html></richcontent>`+"\n", pad, escapeXMLText(t.Notes))
	}
	for _, child := range t.Children {
		topicToFreeMind(sb, child, indent+1)
	}
	fmt.Fprintf(sb, "%s</node>\n", pad)
}

func escapeXMLAttr(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}

func escapeXMLText(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}

func sanitizeFilename(name string) string {
	var out strings.Builder
	for _, r := range name {
		switch r {
		case '"', '/', '\\', ':', '*', '?', '<', '>', '|':
			out.WriteRune('_')
		default:
			out.WriteRune(r)
		}
	}
	s := out.String()
	if s == "" {
		return "mindmap"
	}
	return s
}
