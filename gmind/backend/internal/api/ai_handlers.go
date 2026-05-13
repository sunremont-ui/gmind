package api

import (
	"encoding/json"
	"net/http"

	"github.com/gmind/backend/internal/ai"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/xmind"
	"github.com/go-chi/chi/v5"
)

func (h *Handler) AIGenerate(w http.ResponseWriter, r *http.Request) {
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

	var req model.AIGenerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	aiClient := aiFromContext(r.Context())
	if aiClient == nil {
		writeError(w, http.StatusServiceUnavailable, "AI service not configured")
		return
	}

	sheet := wb.GetSheet(req.SheetID)
	if sheet == nil {
		writeError(w, http.StatusNotFound, "sheet not found")
		return
	}

	prompt := req.Prompt
	if sheet.ImportedData != "" {
		prompt = "Импортированные данные:\n" + sheet.ImportedData + "\n\nНа основе этих данных: " + prompt
	}

	result, err := aiClient.GenerateMindMap(r.Context(), prompt)
	if err != nil {
		internalError(w, err)
		return
	}

	var parent *model.Topic
	if req.ParentID != "" {
		parent = sheet.FindTopic(req.ParentID)
	} else {
		parent = sheet.RootTopic
	}

	if parent == nil {
		writeError(w, http.StatusNotFound, "parent topic not found")
		return
	}

	var created []*model.Topic
	for _, gt := range result.Topics {
		topic := addGeneratedTopic(parent, &gt)
		created = append(created, topic)
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"topics": created,
	})
}

func addGeneratedTopic(parent *model.Topic, gt *ai.GenerateTopic) *model.Topic {
	topic := model.NewTopic(gt.Title)
	parent.AddChild(topic)

	for i := range gt.Children {
		addGeneratedTopic(topic, &gt.Children[i])
	}

	return topic
}

func (h *Handler) AIExpandTopic(w http.ResponseWriter, r *http.Request) {
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
		SheetID  string   `json:"sheet_id"`
		ParentID string   `json:"parent_id"`
		Title    string   `json:"title"`
		Children []string `json:"children"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	aiClient := aiFromContext(r.Context())
	if aiClient == nil {
		writeError(w, http.StatusServiceUnavailable, "AI service not configured")
		return
	}

	sheet := wb.GetSheet(req.SheetID)
	if sheet == nil {
		writeError(w, http.StatusNotFound, "sheet not found")
		return
	}

	var parent *model.Topic
	if req.ParentID != "" {
		parent = sheet.FindTopic(req.ParentID)
	} else {
		parent = sheet.RootTopic
	}
	if parent == nil {
		writeError(w, http.StatusNotFound, "parent topic not found")
		return
	}

	result, err := aiClient.ExpandTopic(r.Context(), req.Title, req.Children)
	if err != nil {
		internalError(w, err)
		return
	}

	var created []*model.Topic
	for _, gt := range result.Topics {
		topic := addGeneratedTopic(parent, &gt)
		created = append(created, topic)
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"topics": created,
	})
}

func (h *Handler) AIImageGenerate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Prompt string `json:"prompt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "prompt is required")
		return
	}

	aiClient := aiFromContext(r.Context())
	if aiClient == nil {
		writeError(w, http.StatusServiceUnavailable, "AI service not configured")
		return
	}

	b64, err := aiClient.GenerateImage(r.Context(), req.Prompt)
	if err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"b64_json": b64,
	})
}

func (h *Handler) AIChat(w http.ResponseWriter, r *http.Request) {
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

	var req model.AIChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	aiClient := aiFromContext(r.Context())
	if aiClient == nil {
		writeError(w, http.StatusServiceUnavailable, "AI service not configured")
		return
	}

	xmindData, err := xmind.Export(wb)
	if err != nil {
		internalError(w, err)
		return
	}

	contextData := string(xmindData)
	if sheet := wb.GetSheet(req.SheetID); sheet != nil && sheet.ImportedData != "" {
		contextData += "\n\n--- Импортированные данные ---\n" + sheet.ImportedData
	}

	result, err := aiClient.Chat(r.Context(), req.Message, contextData)
	if err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (h *Handler) SwitchAIProvider(w http.ResponseWriter, r *http.Request) {
	var req model.SwitchAIProviderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	aiClient := aiFromContext(r.Context())
	if aiClient == nil {
		writeError(w, http.StatusServiceUnavailable, "AI service not configured")
		return
	}

	var apiKey, baseURL, modelName string
	var useYandex bool
	switch req.Provider {
	case "openai":
		apiKey = h.openAIAPIKey
		baseURL = h.openAIEndpoint
		modelName = h.openAIModel
	case "local":
		if req.Endpoint == "" {
			req.Endpoint = "http://localhost:8081/v1"
		}
		if req.Model == "" {
			req.Model = "qwen2.5-coder-7b-instruct"
		}
		apiKey = req.APIKey
		baseURL = req.Endpoint
		modelName = req.Model
	case "yandex":
		useYandex = true
		apiKey = req.APIKey
		if apiKey == "" {
			apiKey = h.yandexAPIKey
		}
		baseURL = "https://llm.api.cloud.yandex.net/foundationModels/v1"
		modelName = req.Model
		if modelName == "" {
			modelName = h.yandexModel
		}
		folderID := req.FolderID
		if folderID == "" {
			folderID = h.yandexFolderID
		}
		if h.agentModule != nil {
			h.agentModule.SetYandexEndpoint(apiKey, folderID, modelName)
		}
	default:
		writeError(w, http.StatusBadRequest, "unknown provider: must be 'openai', 'local', or 'yandex'")
		return
	}

	if !useYandex {
		aiClient.UpdateEndpoint(apiKey, baseURL, modelName)
		if h.agentModule != nil {
			h.agentModule.SetAIEndpoint(apiKey, baseURL, modelName)
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status":   "ok",
		"provider": req.Provider,
	})
}

func (h *Handler) ExportXMind(w http.ResponseWriter, r *http.Request) {
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

	data, err := xmind.Export(wb)
	if err != nil {
		internalError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename=\""+wb.Title+".xmind\"")
	w.Write(data)
}
