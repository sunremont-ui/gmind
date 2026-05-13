package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gmind/backend/internal/agent"
	"github.com/gmind/backend/internal/ai"
	"github.com/gmind/backend/internal/api"
	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/wiki"
	"github.com/gmind/backend/internal/ws"
)

func main() {
	cfg := config.Load()

	db, err := store.New(cfg.DBPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	hub := ws.NewHub(db)
	go hub.Run()

	// --- Core Module System ---
	eventBus := core.NewEventBus()
	logger := core.NewStdLogger()
	storeAdapter := core.NewStoreAdapter(db)
	configProvider := core.NewConfigProvider(cfg)
	deps := &core.Dependencies{
		EventBus: eventBus,
		Store:    storeAdapter,
		Logger:   logger,
		Config:   configProvider,
	}
	registry := core.NewRegistry(deps)

	// Register core modules
	agentModule := agent.NewModule()
	if err := registry.Register(agentModule); err != nil {
		log.Fatalf("failed to register agent module: %v", err)
	}

	wikiStore, err := wiki.NewStore(cfg.WikiPath)
	if err != nil {
		log.Fatalf("failed to create wiki store: %v", err)
	}
	wikiModule := wiki.NewModule(wikiStore)
	if err := registry.Register(wikiModule); err != nil {
		log.Fatalf("failed to register wiki module: %v", err)
	}

	ctx := context.Background()
	if err := registry.StartAll(ctx); err != nil {
		log.Fatalf("failed to start modules: %v", err)
	}
	defer registry.StopAll(ctx)
	// -------------------------

	// Wire up agent TaskStore (SQLite persistence) and WorkerPool
	taskStore := store.NewTaskStore(db.DB())
	agentModule.InitTaskStore(taskStore)

	wp := agent.NewWorkerPool(agentModule.TaskQueue, db, agentModule.PromptStore, logger, eventBus, wikiStore)
	wp.SetAIEndpoint(cfg.AIAPIKey, cfg.AIEndpoint, cfg.AIModel)
	agentModule.WorkerPool = wp

	// Relay agent events to all WebSocket clients
	eventBus.SubscribeGlobally(func(event core.Event) {
		if len(event.Type) < 6 || event.Type[:6] != "agent:" {
			return
		}
		msg, _ := json.Marshal(model.WSMessage{
			Type:    event.Type,
			Payload: event.Payload,
		})
		hub.BroadcastAll(msg)

		// Also forward task log events to SSE brokers
		if event.Type == "agent:task_log" {
			pl := event.Payload
			taskID, _ := pl["task_id"].(string)
			agentID, _ := pl["agent_id"].(string)
			level, _ := pl["level"].(string)
			message, _ := pl["message"].(string)
			toolName, _ := pl["tool_name"].(string)
			toolArgs, _ := pl["tool_args"].(string)
			result, _ := pl["result"].(string)
			content, _ := pl["content"].(string)
			step := 0
			if v, ok := pl["step"].(float64); ok {
				step = int(v)
			}
			api.PublishTaskLogStructured(taskID, agentID, level, toolName, toolArgs, result, message, step)
			if content != "" {
				api.PublishTaskLog(taskID, agentID, level, content)
			}
		}
	})

	handler := api.New(db, hub, cfg.LlamaConfigPath, registry)
	r := handler.Router(cfg)

	aiClient := ai.New(cfg.AIAPIKey, cfg.AIEndpoint, cfg.AIModel)
	r = api.AIContextMiddleware(aiClient)(r)
	if cfg.AIAPIKey != "" {
		log.Printf("AI service initialized with model: %s", cfg.AIModel)
	} else {
		log.Println("AI service started in dynamic mode — use POST /api/v1/ai/provider to configure")
	}

	addr := ":" + cfg.Port
	log.Printf("Gmind server starting on %s", addr)
	log.Printf("API: http://localhost%s/api/v1", addr)
	log.Printf("WebSocket: ws://localhost%s/ws", addr)

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
