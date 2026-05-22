package api

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gmind/backend/internal/agent"
	"github.com/gmind/backend/internal/ai"
	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/llama"
	"github.com/gmind/backend/internal/mcp"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/rag"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/webhook"
	"github.com/gmind/backend/internal/wiki"
	"github.com/gmind/backend/internal/ws"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

type Handler struct {
	store           *store.Store
	scheduleStore   *store.ScheduledTaskStore
	hub             *ws.Hub
	llamaHandler    *LlamaHandler
	ollamaHandler   *OllamaHandler
	registry        *core.Registry
	agentModule     *agent.Module
	ragService      *rag.Service
	openAIEndpoint  string
	openAIModel     string
	openAIAPIKey    string
	yandexAPIKey    string
	yandexFolderID  string
	yandexModel     string
	mcpHandler      http.HandlerFunc
	maSysBaseURL    string
	webhooks        *webhook.Store
}

// SetRAG wires a RAG service for semantic search endpoints and agent tools.
func (h *Handler) SetRAG(svc *rag.Service) {
	h.ragService = svc
}

func New(s *store.Store, hub *ws.Hub, cfgPath string, registry *core.Registry, scheduleStore *store.ScheduledTaskStore) *Handler {
	ollamaDetector := ai.NewOllamaDetector("http://localhost:11434")
	ollamaDetector.Start(0)

	h := &Handler{
		store:         s,
		scheduleStore: scheduleStore,
		hub:           hub,
		llamaHandler:  NewLlamaHandler(llama.New(), cfgPath),
		ollamaHandler: NewOllamaHandler(ollamaDetector),
		registry:      registry,
	}
	if s != nil {
		h.webhooks = webhook.NewStore(s.DB())
	}
	// Extract agent module ref for worker pool updates
	if registry != nil {
		if m := registry.Get("agent"); m != nil {
			if am, ok := m.(*agent.Module); ok {
				h.agentModule = am
			}
		}
		// Set up MCP handler if wiki module is available
		if m := registry.Get("wiki"); m != nil {
			if wm, ok := m.(*wiki.Module); ok {
				mcpServer := mcp.NewServer(wm.Store(), s)
				h.mcpHandler = mcp.HTTPHandler(mcpServer)
			}
		}
	}
	return h
}

func (h *Handler) Router(cfg *config.Config) http.Handler {
	h.openAIEndpoint = cfg.AIEndpoint
	h.openAIModel = cfg.AIModel
	h.openAIAPIKey = cfg.AIAPIKey
	h.yandexAPIKey = cfg.YandexAPIKey
	h.yandexFolderID = cfg.YandexFolderID
	h.yandexModel = cfg.YandexModel
	h.maSysBaseURL = cfg.MASysBaseURL

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-User-ID"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/modules", h.ListModules)
		r.Route("/workbooks", func(r chi.Router) {
			r.Get("/", h.ListWorkbooks)
			r.Post("/", h.CreateWorkbook)
			r.Post("/import", h.ImportXMind)
			r.Route("/{workbookID}", func(r chi.Router) {
				r.Get("/", h.GetWorkbook)
				r.Put("/", h.UpdateWorkbook)
				r.Delete("/", h.DeleteWorkbook)
				r.Post("/sheets", h.CreateSheet)
				r.Put("/sheets/{sheetID}", h.UpdateSheet)
				r.Delete("/sheets/{sheetID}", h.DeleteSheet)
				r.Post("/topics", h.CreateTopic)
				r.Post("/topics/batch", h.BatchCreateTopics)
				r.Put("/topics/{topicID}", h.UpdateTopic)
				r.Delete("/topics/{topicID}", h.DeleteTopic)
				r.Post("/topics/{topicID}/move", h.MoveTopic)
				r.Post("/topics/{topicID}/copy-to-workbook", h.CopyTopicToWorkbook)
				r.Post("/floating-topics", h.CreateFloatingTopic)
				r.Put("/floating-topics/{topicID}", h.UpdateFloatingTopic)
				r.Delete("/floating-topics/{topicID}", h.DeleteFloatingTopic)
				r.Post("/relationships", h.CreateRelationship)
				r.Delete("/relationships/{relID}", h.DeleteRelationship)
				r.Get("/export", h.ExportXMind)
				r.Get("/export/markdown", h.ExportMarkdown)
				r.Post("/import-json", h.ImportJSONData)
				r.Delete("/import-json", h.ClearImportedData)
				r.Post("/ai/generate", h.AIGenerate)
				r.Get("/ai/generate/stream", h.AIGenerateStream)
				r.Post("/ai/expand", h.AIExpandTopic)
				r.Post("/ai/image", h.AIImageGenerate)
				r.Post("/ai/chat", h.AIChat)
				r.Post("/collaborators", h.AddCollaborator)
				r.Delete("/collaborators/{userID}", h.RemoveCollaborator)
				r.Get("/collaborators", h.ListCollaborators)
			})
		})
	})

// Module routes
	r.Route("/api/v1/agents", func(r chi.Router) {
		agentHandler := NewAgentHandler(h.store, nil, h.registry)
		// Try to get agent module from registry
		if h.registry != nil {
			if m := h.registry.Get("agent"); m != nil {
				if am, ok := m.(*agent.Module); ok {
					agentHandler = NewAgentHandler(h.store, am, h.registry)
				}
			}
		}
		agentHandler.RegisterRoutes(r)

		// Schedule sub-router: /api/v1/agents/{agentID}/schedule
		scheduleHandler := NewScheduleHandler(h.scheduleStore, h.agentModule)
		r.Route("/{agentID}/schedule", func(r chi.Router) {
			scheduleHandler.RegisterRoutes(r)
		})
	})

	r.Get("/api/v1/ai/models", h.ListModels)
	r.Post("/api/v1/ai/provider", h.SwitchAIProvider)
	r.Post("/api/v1/ai/image", h.AIImageGenerate)
	r.Post("/api/v1/config", h.ApplyConfig)
	r.Get("/api/v1/masys/pipelines", h.ListMaSysPipelines)

	// Semantic search
	searchHandler := NewSearchHandler(h.ragService)
	r.Get("/api/v1/search", searchHandler.Search)

	r.Route("/api/v1/notes", func(r chi.Router) {
		r.Get("/", h.ListNotes)
		r.Post("/", h.CreateNote)
		r.Put("/{noteID}", h.UpdateNote)
		r.Delete("/{noteID}", h.DeleteNote)
	})

	r.Route("/api/v1/webhooks", func(r chi.Router) {
		r.Post("/", h.CreateWebhook)
		r.Get("/", h.ListWebhooks)
		r.Delete("/{webhookID}", h.DeleteWebhook)
	})


	// MCP endpoint (if wiki module is available)
	if h.mcpHandler != nil {
		r.Post("/api/v1/mcp", h.mcpHandler)
	}

	r.Route("/api/v1/llama", func(r chi.Router) {
		r.Get("/status", h.llamaHandler.Status)
		r.Post("/start", h.llamaHandler.Start)
		r.Post("/stop", h.llamaHandler.Stop)
		r.Put("/config", h.llamaHandler.UpdateConfig)
		r.Post("/config/save", h.llamaHandler.SaveConfig)
	})

	r.Get("/api/v1/ollama/status", h.ollamaHandler.Status)

	msHandler := NewModelServersHandler(cfg.ModelServersConfigPath)
	r.Get("/api/v1/model-servers", msHandler.List)
	r.Put("/api/v1/model-servers", msHandler.Save)

	r.Get("/ws", h.HandleWebSocket)

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		dbOK := false
		if h.store != nil {
			dbOK = h.store.DB().PingContext(r.Context()) == nil
		}
		agentsCount := 0
		if h.agentModule != nil {
			agentsCount = len(h.agentModule.Registry().List())
		}
		json.NewEncoder(w).Encode(map[string]any{
			"status":       "ok",
			"db_ok":        dbOK,
			"agents_count": agentsCount,
		})
	})

	return r
}

// chiRouter is a subset of chi.Router used by module route registration.
type chiRouter interface {
	Get(pattern string, handlerFn http.HandlerFunc)
	Post(pattern string, handlerFn http.HandlerFunc)
	Put(pattern string, handlerFn http.HandlerFunc)
	Patch(pattern string, handlerFn http.HandlerFunc)
	Delete(pattern string, handlerFn http.HandlerFunc)
}

func (h *Handler) ListModules(w http.ResponseWriter, r *http.Request) {
	if h.registry == nil {
		writeJSON(w, http.StatusOK, []core.ModuleInfo{})
		return
	}
	writeJSON(w, http.StatusOK, h.registry.List())
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	if status >= 500 {
		log.Printf("ERROR %d: %s", status, msg)
	}
	writeJSON(w, status, model.NewErrorResponse(codeForStatus(status), status, msg))
}

func writeErrorWithCode(w http.ResponseWriter, status int, code model.ErrorCode, msg string) { //nolint:unused
	if status >= 500 {
		log.Printf("ERROR %d [%s]: %s", status, code, msg)
	}
	writeJSON(w, status, model.NewErrorResponse(code, status, msg))
}

func internalError(w http.ResponseWriter, err error) {
	log.Printf("ERROR 500: %v", err)
	writeJSON(w, http.StatusInternalServerError,
		model.NewErrorResponse(model.ErrInternal, http.StatusInternalServerError, "internal server error"))
}

func codeForStatus(status int) model.ErrorCode {
	switch status {
	case http.StatusBadRequest:
		return model.ErrInvalidRequest
	case http.StatusNotFound:
		return model.ErrNotFound
	case http.StatusConflict:
		return model.ErrConflict
	case http.StatusServiceUnavailable:
		return model.ErrServiceUnavailable
	case http.StatusInternalServerError:
		return model.ErrInternal
	default:
		return model.ErrInternal
	}
}
