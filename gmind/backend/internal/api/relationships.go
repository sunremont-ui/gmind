package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

// validRelationshipType ensures the type is one of the supported semantic kinds (or custom).
func validRelationshipType(t string) bool {
	switch t {
	case "", "relates_to", "depends_on", "supports", "contradicts", "references", "blocks", "custom":
		return true
	}
	return false
}

func validRelationshipDirection(d string) bool {
	switch d {
	case "", "forward", "bidirectional", "undirected":
		return true
	}
	return false
}

func validRelationshipStyle(s string) bool {
	switch s {
	case "", "solid", "dashed", "dotted":
		return true
	}
	return false
}

// CreateRelationshipV2 — POST /api/v1/workbooks/{workbookID}/relationships
// Accepts both legacy {end1_id, end2_id} and V5.0 {from_topic_id, to_topic_id, type, direction, ...}.
func (h *Handler) CreateRelationshipV2(w http.ResponseWriter, r *http.Request) {
	if h.relationships == nil {
		writeError(w, http.StatusServiceUnavailable, "relationships store not initialized")
		return
	}
	workbookID := chi.URLParam(r, "workbookID")
	if workbookID == "" {
		writeError(w, http.StatusBadRequest, "workbookID is required")
		return
	}
	var req model.CreateRelationshipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Normalize endpoints (V5.0 fields take precedence; fall back to legacy)
	from := req.FromTopicID
	if from == "" {
		from = req.End1ID
	}
	to := req.ToTopicID
	if to == "" {
		to = req.End2ID
	}
	if from == "" || to == "" {
		writeError(w, http.StatusBadRequest, "from_topic_id (or end1_id) and to_topic_id (or end2_id) are required")
		return
	}
	if !validRelationshipType(req.Type) {
		writeError(w, http.StatusBadRequest, "invalid type")
		return
	}
	if !validRelationshipDirection(req.Direction) {
		writeError(w, http.StatusBadRequest, "invalid direction")
		return
	}
	if !validRelationshipStyle(req.Style) {
		writeError(w, http.StatusBadRequest, "invalid style")
		return
	}

	rec := &store.RelationshipRecord{
		WorkbookID:     workbookID,
		FromWorkbookID: req.FromWorkbookID,
		FromSheetID:    req.FromSheetID,
		FromTopicID:    from,
		ToWorkbookID:   req.ToWorkbookID,
		ToSheetID:      req.ToSheetID,
		ToTopicID:      to,
		Type:           req.Type,
		Direction:      req.Direction,
		Title:          req.Title,
		Weight:         req.Weight,
		Notes:          req.Notes,
		Color:          req.Color,
		Style:          req.Style,
		CreatedBy:      req.CreatedBy,
	}

	// Optional strict-mode cycle prevention for depends_on graph
	if r.URL.Query().Get("strict") == "true" && (rec.Type == "depends_on" || rec.Type == "blocks") && rec.Direction == "forward" {
		// Would inserting this create a cycle? Use Traverse from `to` and see if we reach `from`.
		reachable, _, err := h.relationships.Traverse(to, 32, []string{rec.Type})
		if err == nil {
			for _, t := range reachable {
				if t == from {
					writeError(w, http.StatusConflict, "creating this edge would form a cycle")
					return
				}
			}
		}
	}

	if err := h.relationships.Insert(rec); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, rec)
}

// ListRelationships — GET /api/v1/workbooks/{workbookID}/relationships?topic_id=...&type=...
func (h *Handler) ListRelationships(w http.ResponseWriter, r *http.Request) {
	if h.relationships == nil {
		writeError(w, http.StatusServiceUnavailable, "relationships store not initialized")
		return
	}
	workbookID := chi.URLParam(r, "workbookID")
	topicID := r.URL.Query().Get("topic_id")
	typeFilter := r.URL.Query().Get("type")

	var rels []*store.RelationshipRecord
	var err error
	if topicID != "" {
		rels, err = h.relationships.ListByTopic(topicID)
	} else {
		rels, err = h.relationships.ListByWorkbook(workbookID)
	}
	if err != nil {
		internalError(w, err)
		return
	}
	if typeFilter != "" {
		filtered := make([]*store.RelationshipRecord, 0, len(rels))
		for _, rel := range rels {
			if rel.Type == typeFilter {
				filtered = append(filtered, rel)
			}
		}
		rels = filtered
	}
	if rels == nil {
		rels = []*store.RelationshipRecord{}
	}
	writeJSON(w, http.StatusOK, rels)
}

// UpdateRelationshipV2 — PUT /api/v1/relationships/{relID}
func (h *Handler) UpdateRelationshipV2(w http.ResponseWriter, r *http.Request) {
	if h.relationships == nil {
		writeError(w, http.StatusServiceUnavailable, "relationships store not initialized")
		return
	}
	relID := chi.URLParam(r, "relID")
	if relID == "" {
		writeError(w, http.StatusBadRequest, "relID is required")
		return
	}
	var req model.UpdateRelationshipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	patch := map[string]any{}
	if req.Title != nil {
		patch["title"] = *req.Title
	}
	if req.Type != nil {
		if !validRelationshipType(*req.Type) {
			writeError(w, http.StatusBadRequest, "invalid type")
			return
		}
		patch["type"] = *req.Type
	}
	if req.Direction != nil {
		if !validRelationshipDirection(*req.Direction) {
			writeError(w, http.StatusBadRequest, "invalid direction")
			return
		}
		patch["direction"] = *req.Direction
	}
	if req.Weight != nil {
		patch["weight"] = *req.Weight
	}
	if req.Notes != nil {
		patch["notes"] = *req.Notes
	}
	if req.Color != nil {
		patch["color"] = *req.Color
	}
	if req.Style != nil {
		if !validRelationshipStyle(*req.Style) {
			writeError(w, http.StatusBadRequest, "invalid style")
			return
		}
		patch["style"] = *req.Style
	}

	if err := h.relationships.Update(relID, patch); err != nil {
		internalError(w, err)
		return
	}
	rec, err := h.relationships.Get(relID)
	if err != nil {
		internalError(w, err)
		return
	}
	if rec == nil {
		writeError(w, http.StatusNotFound, "relationship not found")
		return
	}
	writeJSON(w, http.StatusOK, rec)
}

// DeleteRelationshipV2 — DELETE /api/v1/relationships/{relID}
func (h *Handler) DeleteRelationshipV2(w http.ResponseWriter, r *http.Request) {
	if h.relationships == nil {
		writeError(w, http.StatusServiceUnavailable, "relationships store not initialized")
		return
	}
	relID := chi.URLParam(r, "relID")
	if relID == "" {
		writeError(w, http.StatusBadRequest, "relID is required")
		return
	}
	if err := h.relationships.Delete(relID); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RelatedTopics — GET /api/v1/workbooks/{workbookID}/topics/{topicID}/related?depth=N&types=relates_to,depends_on
func (h *Handler) RelatedTopics(w http.ResponseWriter, r *http.Request) {
	if h.relationships == nil {
		writeError(w, http.StatusServiceUnavailable, "relationships store not initialized")
		return
	}
	topicID := chi.URLParam(r, "topicID")
	if topicID == "" {
		writeError(w, http.StatusBadRequest, "topicID is required")
		return
	}
	depth := 1
	if d := r.URL.Query().Get("depth"); d != "" {
		if v, err := strconv.Atoi(d); err == nil && v > 0 && v <= 5 {
			depth = v
		}
	}
	var types []string
	if t := r.URL.Query().Get("types"); t != "" {
		for _, x := range strings.Split(t, ",") {
			x = strings.TrimSpace(x)
			if x != "" {
				types = append(types, x)
			}
		}
	}
	visited, rels, err := h.relationships.Traverse(topicID, depth, types)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"topic_id":      topicID,
		"depth":         depth,
		"types":         types,
		"topics":        visited,
		"relationships": rels,
	})
}

// DetectCyclesEndpoint — GET /api/v1/workbooks/{workbookID}/cycles?type=depends_on
func (h *Handler) DetectCyclesEndpoint(w http.ResponseWriter, r *http.Request) {
	if h.relationships == nil {
		writeError(w, http.StatusServiceUnavailable, "relationships store not initialized")
		return
	}
	workbookID := chi.URLParam(r, "workbookID")
	if workbookID == "" {
		writeError(w, http.StatusBadRequest, "workbookID is required")
		return
	}
	typeFilter := r.URL.Query().Get("type")
	cycles, err := h.relationships.DetectCycles(workbookID, typeFilter)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"workbook_id": workbookID,
		"type":        typeFilter,
		"cycles":      cycles,
	})
}

// EmbedRelationshipsIntoSheet — backward compat helper.
// Reads relationships from the V5.0 table for a workbook and populates Sheet.Relationships JSON arrays.
// Called by GetWorkbook handler before returning to keep legacy clients working.
func (h *Handler) EmbedRelationshipsIntoSheet(wb *model.Workbook) {
	if wb == nil || h.relationships == nil {
		return
	}
	rels, err := h.relationships.ListByWorkbook(wb.ID)
	if err != nil || len(rels) == 0 {
		return
	}
	// Group by sheet (use FromSheetID if set, else first sheet)
	for _, sheet := range wb.Sheets {
		sheet.Relationships = sheet.Relationships[:0]
	}
	for _, rec := range rels {
		// Map to legacy Relationship struct for embedding
		legacy := &model.Relationship{
			ID:              rec.ID,
			Title:           rec.Title,
			End1ID:          rec.FromTopicID,
			End2ID:          rec.ToTopicID,
			WorkbookID:      rec.WorkbookID,
			FromWorkbookID:  rec.FromWorkbookID,
			FromSheetID:     rec.FromSheetID,
			FromTopicID:     rec.FromTopicID,
			ToWorkbookID:    rec.ToWorkbookID,
			ToSheetID:       rec.ToSheetID,
			ToTopicID:       rec.ToTopicID,
			Type:            rec.Type,
			Direction:       rec.Direction,
			Weight:          rec.Weight,
			Notes:           rec.Notes,
			Color:           rec.Color,
			Style:           rec.Style,
			CreatedBy:       rec.CreatedBy,
			CreatedAt:       rec.CreatedAt,
			UpdatedAt:       rec.UpdatedAt,
			Metadata:        rec.Metadata,
		}
		// Find target sheet: explicit FromSheetID, else first one
		target := wb.Sheets[0]
		if rec.FromSheetID != "" {
			for _, s := range wb.Sheets {
				if s.ID == rec.FromSheetID {
					target = s
					break
				}
			}
		}
		target.Relationships = append(target.Relationships, legacy)
	}
}

// ErrEndpointMissing is a sentinel error for relationship endpoint validation.
var ErrEndpointMissing = errors.New("from_topic_id and to_topic_id are required")
