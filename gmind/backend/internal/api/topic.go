package api

import (
	"encoding/json"
	"net/http"

	"github.com/gmind/backend/internal/model"
	"github.com/go-chi/chi/v5"
)

func (h *Handler) CreateTopic(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	topic := model.NewTopic(req.Title)
	if req.Position != nil {
		topic.Position = req.Position
	}
	if req.Notes != "" {
		topic.Notes = req.Notes
	}
	if req.FontColor != "" {
		topic.FontColor = req.FontColor
	}
	if req.FontSize > 0 {
		topic.FontSize = req.FontSize
	}
	if req.NodeWidth > 0 {
		topic.NodeWidth = req.NodeWidth
	}
	if req.BorderColor != "" {
		topic.BorderColor = req.BorderColor
	}
	if req.Shape != "" {
		topic.Shape = req.Shape
	}
	if req.Icon != "" {
		topic.Icon = req.Icon
	}
	if req.FontFamily != "" {
		topic.FontFamily = req.FontFamily
	}
	if req.FontWeight > 0 {
		topic.FontWeight = req.FontWeight
	}

	found := false
	for _, sheet := range wb.Sheets {
		parent := sheet.FindTopic(req.ParentID)
		if parent != nil {
			parent.AddChild(topic)
			found = true
			break
		}
	}

	if !found {
		writeError(w, http.StatusNotFound, "parent topic not found")
		return
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	if h.webhooks != nil {
		h.webhooks.Notify("topic.created", map[string]any{
			"workbook_id": workbookID,
			"topic":       topic,
		})
	}

	writeJSON(w, http.StatusCreated, topic)
}

func (h *Handler) UpdateTopic(w http.ResponseWriter, r *http.Request) {
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

	var req model.UpdateTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	found := false
	for _, sheet := range wb.Sheets {
		topic := sheet.FindTopic(topicID)
		if topic != nil {
			if req.Title != "" {
				topic.Title = req.Title
			}
			if req.Notes != "" {
				topic.Notes = req.Notes
			}
			if req.Markers != nil {
				topic.Markers = req.Markers
			}
			if req.Labels != nil {
				topic.Labels = req.Labels
			}
			if req.Hyperlink != "" {
				topic.Hyperlink = req.Hyperlink
			}
			if req.Image != "" {
				topic.Image = req.Image
			}
			if req.Folded != nil {
				topic.Folded = *req.Folded
			}
			if req.Position != nil {
				topic.Position = req.Position
			}
			if req.Structure != "" {
				topic.Structure = req.Structure
			}
			if req.BranchSide != "" {
				topic.BranchSide = req.BranchSide
			}
			if req.EdgeStyle != "" {
				topic.EdgeStyle = req.EdgeStyle
			}
			if req.EdgeDash != "" {
				topic.EdgeDash = req.EdgeDash
			}
			if req.FontSize > 0 {
				topic.FontSize = req.FontSize
			}
			if req.FontColor != "" {
				topic.FontColor = req.FontColor
			}
			if req.NodeWidth > 0 {
				topic.NodeWidth = req.NodeWidth
			}
			if req.FontFamily != "" {
				topic.FontFamily = req.FontFamily
			}
			if req.FontWeight > 0 {
				topic.FontWeight = req.FontWeight
			}
			if req.TextAlign != "" {
				topic.TextAlign = req.TextAlign
			}
			if req.BorderWidth > 0 {
				topic.BorderWidth = req.BorderWidth
			}
			if req.Padding > 0 {
				topic.Padding = req.Padding
			}
			if req.Opacity > 0 {
				topic.Opacity = req.Opacity
			}
			if req.Shape != "" {
				topic.Shape = req.Shape
			}
			if req.Progress > 0 {
				topic.Progress = req.Progress
			}
			if req.Priority > 0 {
				topic.Priority = req.Priority
			}
			if req.NodeHeight > 0 {
				topic.NodeHeight = req.NodeHeight
			}
			if req.BorderColor != "" {
				topic.BorderColor = req.BorderColor
			}
			if req.ConnColor != "" {
				topic.ConnColor = req.ConnColor
			}
			if req.ShadowType != "" {
				topic.ShadowType = req.ShadowType
			}
			if req.NodeStyle != "" {
				topic.NodeStyle = req.NodeStyle
			}
			if req.FoldIcon != "" {
				topic.FoldIcon = req.FoldIcon
			}
			if req.ShowChildCount != nil {
				topic.ShowChildCount = *req.ShowChildCount
			}
			if req.Icon != "" {
				topic.Icon = req.Icon
			}
			if req.CommentIcon != "" {
				topic.CommentIcon = req.CommentIcon
			}
			found = true
			break
		}
	}

	if !found {
		writeError(w, http.StatusNotFound, "topic not found")
		return
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	if h.webhooks != nil {
		h.webhooks.Notify("topic.updated", map[string]any{
			"workbook_id": workbookID,
			"topic_id":    topicID,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *Handler) DeleteTopic(w http.ResponseWriter, r *http.Request) {
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
		if sheet.RootTopic.ID == topicID {
			writeError(w, http.StatusBadRequest, "cannot delete root topic")
			return
		}
		found = removeTopicFromParent(sheet.RootTopic, topicID)
		if found {
			break
		}
	}

	if !found {
		writeError(w, http.StatusNotFound, "topic not found")
		return
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	// V5.0: cascade-delete relationships referencing this topic
	if h.relationships != nil {
		_ = h.relationships.DeleteByTopic(topicID)
	}

	if h.webhooks != nil {
		h.webhooks.Notify("topic.deleted", map[string]any{
			"workbook_id": workbookID,
			"topic_id":    topicID,
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

func isDescendantOf(topic *model.Topic, targetID string) bool {
	for _, child := range topic.Children {
		if child.ID == targetID || isDescendantOf(child, targetID) {
			return true
		}
	}
	return false
}

func removeTopicFromParent(topic *model.Topic, id string) bool {
	for i, child := range topic.Children {
		if child.ID == id {
			topic.Children = append(topic.Children[:i], topic.Children[i+1:]...)
			return true
		}
		if removeTopicFromParent(child, id) {
			return true
		}
	}
	return false
}

func (h *Handler) CopyTopicToWorkbook(w http.ResponseWriter, r *http.Request) {
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

	var req model.CopyTopicToWorkbookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Find source topic
	var sourceTopic *model.Topic
	for _, sheet := range wb.Sheets {
		sourceTopic = sheet.FindTopic(topicID)
		if sourceTopic != nil {
			break
		}
	}
	if sourceTopic == nil {
		// Check floating topics
		for _, sheet := range wb.Sheets {
			for _, ft := range sheet.FloatingTopics {
				if ft.ID == topicID {
					sourceTopic = ft
					break
				}
			}
			if sourceTopic != nil {
				break
			}
		}
	}
	if sourceTopic == nil {
		writeError(w, http.StatusNotFound, "topic not found")
		return
	}

	// Get target workbook
	targetWb, err := h.store.GetWorkbook(req.TargetWorkbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if targetWb == nil {
		writeError(w, http.StatusNotFound, "target workbook not found")
		return
	}

	// Deep copy topic
	copied := sourceTopic.DeepCopy()

	// Find target parent
	if req.TargetParentID != "" {
		found := false
		for _, sheet := range targetWb.Sheets {
			parent := sheet.FindTopic(req.TargetParentID)
			if parent != nil {
				parent.AddChild(copied)
				found = true
				break
			}
		}
		if !found {
			writeError(w, http.StatusNotFound, "target parent not found")
			return
		}
	} else {
		// Add as floating topic in first sheet
		if len(targetWb.Sheets) > 0 {
			targetWb.Sheets[0].FloatingTopics = append(targetWb.Sheets[0].FloatingTopics, copied)
		}
	}

	if err := h.store.UpdateWorkbook(targetWb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, copied)
}

func (h *Handler) MoveTopic(w http.ResponseWriter, r *http.Request) {
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

	var req model.MoveTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Find new parent BEFORE removing the source topic,
	// in case the target is a descendant of the source.
	var newParent *model.Topic
	for _, sheet := range wb.Sheets {
		newParent = sheet.FindTopic(req.NewParentID)
		if newParent != nil {
			break
		}
	}
	if newParent == nil {
		writeError(w, http.StatusNotFound, "new parent topic not found")
		return
	}

	// Find and remove the source topic
	var topicToMove *model.Topic
	for _, sheet := range wb.Sheets {
		topicToMove = sheet.FindTopic(topicID)
		if topicToMove != nil {
			removeTopicFromParent(sheet.RootTopic, topicID)
			break
		}
	}

	if topicToMove == nil {
		writeError(w, http.StatusNotFound, "topic not found")
		return
	}

	// Check for cycle: newParent must not be a descendant of topicToMove
	if topicToMove.ID == newParent.ID || isDescendantOf(topicToMove, newParent.ID) {
		writeError(w, http.StatusBadRequest, "cannot move topic to its own descendant")
		return
	}

	newParent.InsertChildAt(req.Index, topicToMove)

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "moved"})
}

func (h *Handler) CreateRelationship(w http.ResponseWriter, r *http.Request) {
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

	var req model.CreateRelationshipRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	rel := model.NewRelationship(req.Title, req.End1ID, req.End2ID)

	found := false
	for _, sheet := range wb.Sheets {
		if sheet.FindTopic(req.End1ID) != nil && sheet.FindTopic(req.End2ID) != nil {
			sheet.AddRelationship(rel)
			found = true
			break
		}
	}

	if !found {
		writeError(w, http.StatusNotFound, "topics not found on same sheet")
		return
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, rel)
}

func (h *Handler) BatchCreateTopics(w http.ResponseWriter, r *http.Request) {
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

	var req model.BatchCreateTopicsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Topics) == 0 {
		writeJSON(w, http.StatusOK, map[string]any{"created": []any{}})
		return
	}

	type createdItem struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	created := make([]createdItem, 0, len(req.Topics))

	for _, item := range req.Topics {
		topic := model.NewTopic(item.Title)
		if item.Position != nil {
			topic.Position = item.Position
		}
		if item.Notes != "" {
			topic.Notes = item.Notes
		}
		if item.FontColor != "" {
			topic.FontColor = item.FontColor
		}
		if item.FontSize > 0 {
			topic.FontSize = item.FontSize
		}
		if item.NodeWidth > 0 {
			topic.NodeWidth = item.NodeWidth
		}
		if item.BorderColor != "" {
			topic.BorderColor = item.BorderColor
		}
		if item.Shape != "" {
			topic.Shape = item.Shape
		}
		if item.Icon != "" {
			topic.Icon = item.Icon
		}

		found := false
		for _, sheet := range wb.Sheets {
			parent := sheet.FindTopic(item.ParentID)
			if parent != nil {
				parent.AddChild(topic)
				found = true
				break
			}
		}
		if !found {
			writeError(w, http.StatusNotFound, "parent topic not found: "+item.ParentID)
			return
		}
		created = append(created, createdItem{ID: topic.ID, Title: topic.Title})
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"created": created})
}

func (h *Handler) DeleteRelationship(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	relID := chi.URLParam(r, "relID")

	// V5.0: try table-backed delete first
	if h.relationships != nil {
		if err := h.relationships.Delete(relID); err == nil {
			// Also clean any legacy embedding in workbook JSON (best-effort)
			if wb, _ := h.store.GetWorkbook(workbookID); wb != nil {
				for _, sheet := range wb.Sheets {
					sheet.RemoveRelationship(relID)
				}
				_ = h.store.UpdateWorkbook(wb)
			}
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	// Fallback: legacy path
	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}
	for _, sheet := range wb.Sheets {
		sheet.RemoveRelationship(relID)
	}
	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
