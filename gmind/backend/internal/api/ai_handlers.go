package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/gmind/backend/internal/ai"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/xmind"
	"github.com/go-chi/chi/v5"
)

// AIModel represents a single AI model option.
type AIModel struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// AIModelProvider represents a group of models from one provider.
type AIModelProvider struct {
	ID     string    `json:"id"`
	Label  string    `json:"label"`
	Models []AIModel `json:"models"`
}

var openAIModels = []AIModel{
	{ID: "gpt-4o", Label: "GPT-4o"},
	{ID: "gpt-4o-mini", Label: "GPT-4o Mini"},
	{ID: "gpt-4-turbo", Label: "GPT-4 Turbo"},
	{ID: "gpt-3.5-turbo", Label: "GPT-3.5 Turbo"},
	{ID: "o1", Label: "o1"},
	{ID: "o1-mini", Label: "o1 Mini"},
	{ID: "o3-mini", Label: "o3 Mini"},
}

var yandexModels = []AIModel{
	{ID: "yandexgpt", Label: "YandexGPT"},
	{ID: "yandexgpt-lite", Label: "YandexGPT Lite"},
	{ID: "yandexgpt-rc", Label: "YandexGPT RC"},
}

// ListModels returns all available AI models grouped by provider.
func (h *Handler) ListModels(w http.ResponseWriter, r *http.Request) {
	providers := []AIModelProvider{
		{ID: "openai", Label: "OpenAI", Models: openAIModels},
	}

	// Add Ollama models if detected
	if h.ollamaHandler != nil {
		detected, ollamaModels := h.ollamaHandler.Detector().Status()
		if detected && len(ollamaModels) > 0 {
			models := make([]AIModel, 0, len(ollamaModels))
			for _, m := range ollamaModels {
				models = append(models, AIModel{ID: m.Name, Label: m.Name})
			}
			providers = append(providers, AIModelProvider{ID: "ollama", Label: "Ollama (local)", Models: models})
		}
	}

	providers = append(providers, AIModelProvider{ID: "yandex", Label: "Yandex GPT", Models: yandexModels})

	if h.llamaHandler != nil {
		localModels := make([]AIModel, 0)
		for _, modelName := range h.llamaHandler.Models() {
			localModels = append(localModels, AIModel{ID: modelName, Label: modelName})
		}
		if len(localModels) > 0 {
			providers = append(providers, AIModelProvider{ID: "local", Label: "Local LLM (llama.cpp)", Models: localModels})
		} else {
			providers = append(providers, AIModelProvider{ID: "local", Label: "Local LLM (llama.cpp)", Models: []AIModel{{ID: h.openAIModel, Label: h.openAIModel}}})
		}
	} else {
		providers = append(providers, AIModelProvider{ID: "local", Label: "Local LLM (llama.cpp)", Models: []AIModel{{ID: h.openAIModel, Label: h.openAIModel}}})
	}

	writeJSON(w, http.StatusOK, map[string]any{"providers": providers})
}

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

// AIGenerateStream streams mind-map topics via SSE as the LLM produces them.
// GET /workbooks/{workbookID}/ai/generate/stream?prompt=...&sheet_id=...&parent_id=...
// SSE events: data: {"topic":{"id":"...","title":"..."},"done":false}  …  data: {"done":true,"count":N}
func (h *Handler) AIGenerateStream(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	prompt := r.URL.Query().Get("prompt")
	sheetID := r.URL.Query().Get("sheet_id")
	parentID := r.URL.Query().Get("parent_id")

	if prompt == "" {
		writeError(w, http.StatusBadRequest, "prompt is required")
		return
	}

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
	if sheet == nil && len(wb.Sheets) > 0 {
		sheet = wb.Sheets[0]
	}
	if sheet == nil {
		writeError(w, http.StatusNotFound, "no sheets in workbook")
		return
	}

	var parent *model.Topic
	if parentID != "" {
		parent = sheet.FindTopic(parentID)
	} else {
		parent = sheet.RootTopic
	}
	if parent == nil {
		writeError(w, http.StatusNotFound, "parent topic not found")
		return
	}

	aiClient := aiFromContext(r.Context())
	if aiClient == nil {
		writeError(w, http.StatusServiceUnavailable, "AI service not configured")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	fmt.Fprintf(w, ":connected\n\n")
	flusher.Flush()

	finalPrompt := prompt
	if sheet.ImportedData != "" {
		finalPrompt = "Imported data:\n" + sheet.ImportedData + "\n\nBased on this: " + prompt
	}

	topicCh := make(chan ai.GenerateTopic, 10)
	errCh := make(chan error, 1)

	go func() {
		err := aiClient.GenerateMindMapStream(r.Context(), finalPrompt, topicCh)
		close(topicCh)
		errCh <- err
	}()

	var created []*model.Topic
	ctx := r.Context()

loop:
	for {
		select {
		case gt, ok := <-topicCh:
			if !ok {
				break loop
			}
			t := addGeneratedTopic(parent, &gt)
			created = append(created, t)
			data, _ := json.Marshal(map[string]any{
				"topic": map[string]any{"id": t.ID, "title": t.Title},
				"done":  false,
			})
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		case <-ctx.Done():
			return
		}
	}

	if err := <-errCh; err != nil {
		data, _ := json.Marshal(map[string]any{"error": err.Error(), "done": true})
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
		return
	}

	if len(created) > 0 {
		if err := h.store.UpdateWorkbook(wb); err != nil {
			data, _ := json.Marshal(map[string]any{"error": "save failed: " + err.Error(), "done": true})
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
			return
		}
	}

	data, _ := json.Marshal(map[string]any{"done": true, "count": len(created)})
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()
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

// ConfigRequest is sent by Tauri on startup to inject secrets into the backend.
type ConfigRequest struct {
	OpenAIAPIKey   string `json:"openai_api_key,omitempty"`
	OpenAIEndpoint string `json:"openai_endpoint,omitempty"`
	OpenAIModel    string `json:"openai_model,omitempty"`
	YandexAPIKey   string `json:"yandex_api_key,omitempty"`
	YandexFolderID string `json:"yandex_folder_id,omitempty"`
	YandexModel    string `json:"yandex_model,omitempty"`
}

func (h *Handler) ApplyConfig(w http.ResponseWriter, r *http.Request) {
	var req ConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	aiClient := aiFromContext(r.Context())
	if aiClient == nil {
		writeError(w, http.StatusServiceUnavailable, "AI service not configured")
		return
	}

	if req.OpenAIAPIKey != "" {
		endpoint := req.OpenAIEndpoint
		if endpoint == "" {
			endpoint = "https://api.openai.com/v1"
		}
		model := req.OpenAIModel
		if model == "" {
			model = "gpt-4o"
		}
		h.openAIAPIKey = req.OpenAIAPIKey
		h.openAIEndpoint = endpoint
		h.openAIModel = model
		aiClient.UpdateEndpoint(req.OpenAIAPIKey, endpoint, model)
		if h.agentModule != nil {
			h.agentModule.SetAIEndpoint(req.OpenAIAPIKey, endpoint, model)
		}
	}

	if req.YandexAPIKey != "" {
		h.yandexAPIKey = req.YandexAPIKey
		if req.YandexFolderID != "" {
			h.yandexFolderID = req.YandexFolderID
		}
		if req.YandexModel != "" {
			h.yandexModel = req.YandexModel
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// ListMaSysPipelines proxies GET /trpc/pipelines.list from MASys.
func (h *Handler) ListMaSysPipelines(w http.ResponseWriter, r *http.Request) {
	url := fmt.Sprintf("%s/trpc/pipelines.list", h.maSysBaseURL)
	resp, err := http.Get(url)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"pipelines": []any{}, "error": err.Error()})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	// Parse tRPC envelope and unwrap pipelines list
	var trpcResp struct {
		Result struct {
			Data struct {
				JSON any `json:"json"`
			} `json:"data"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &trpcResp); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"pipelines": []any{}})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"pipelines": trpcResp.Result.Data.JSON})
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
			req.Endpoint = "http://localhost:1100/v1"
		}
		if req.Model == "" {
			req.Model = "qwen2.5-coder-7b-instruct"
		}
		apiKey = req.APIKey
		baseURL = req.Endpoint
		modelName = req.Model
	case "ollama":
		baseURL = h.ollamaHandler.detector.BaseURL() + "/v1"
		if req.Model == "" {
			detected, models := h.ollamaHandler.detector.Status()
			if detected && len(models) > 0 {
				modelName = models[0].Name
			} else {
				modelName = "llama3"
			}
		} else {
			modelName = req.Model
		}
		apiKey = ""
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
		writeError(w, http.StatusBadRequest, "unknown provider: must be 'openai', 'local', 'ollama', or 'yandex'")
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
