package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gmind/backend/internal/agent"
	"github.com/gmind/backend/internal/ai"
	"github.com/gmind/backend/internal/api"
	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/rag"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/wiki"
	"github.com/gmind/backend/internal/ws"
)

// routerHolder wraps http.Handler for atomic storage.
type routerHolder struct{ h http.Handler }

func main() {
	cfg := config.Load()

	// Always bind to the configured port (default 1010).
	// Stale instances are killed by the Tauri sidecar launcher before startup.
	port := cfg.Port
	addr := ":" + port
	log.Printf("Gmind server starting on %s", addr)

	// atomicRouter is nil until the full router is ready; early requests get 503.
	var atomicRouter atomic.Value

	earlyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if v := atomicRouter.Load(); v != nil {
			v.(routerHolder).h.ServeHTTP(w, r)
			return
		}
		w.WriteHeader(http.StatusServiceUnavailable)
	})

	srv := &http.Server{
		Addr:    addr,
		Handler: earlyHandler,
	}

	// Start listening immediately — frontend can poll /health right away.
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server failed: %v", err)
		}
	}()

	// Set up shutdown signal early so we don't miss SIGTERM during long init.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)

	// --- Full initialization ---

	db, err := store.New(cfg.DBPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	hub := ws.NewHub(db)
	go hub.Run()

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

	taskStore := store.NewTaskStore(db.DB())
	agentModule.InitTaskStore(taskStore)

	agentStore := store.NewAgentStore(db.DB())
	agentModule.InitAgentStore(agentStore)

	wp := agent.NewWorkerPool(agentModule.TaskQueue, db, agentModule.PromptStore, logger, eventBus, wikiStore, agentModule.Manager())
	wp.SetAIEndpoint(cfg.AIAPIKey, cfg.AIEndpoint, cfg.AIModel)
	wp.SetMaSysBaseURL(cfg.MASysBaseURL)
	agentModule.WorkerPool = wp

	// Auto-start workers for all agents loaded from SQLite
	for _, ag := range agentModule.Registry().List() {
		wp.StartWorker(ag)
	}

	// RAG: semantic search over mindmap topics
	embeddingStore := store.NewEmbeddingStore(db.DB())
	ragSvc := rag.New(cfg.AIAPIKey, cfg.AIEndpoint, embeddingStore)
	wp.SetRAG(ragSvc)

	// V5.0: graph relationships for agent tools (create_relationship, get_related_topics, etc.)
	relStore := store.NewRelationshipStore(db.DB())
	wp.SetRelationshipStore(relStore)
	// Index all existing topics in background (silent on missing API key)
	go ragSvc.IndexAll(context.Background(), db)

	// GI-7: backfill the full-text index in background (no API key needed)
	go func() {
		if err := db.ReindexAllFTS(); err != nil {
			log.Printf("fts backfill: %v", err)
		}
	}()

	scheduleStore := store.NewScheduledTaskStore(db.DB())
	agentModule.InitScheduler(scheduleStore, wp)
	schedulerCtx, schedulerCancel := context.WithCancel(context.Background())
	go agentModule.Scheduler.Start(schedulerCtx)
	defer schedulerCancel()

	eventBus.SubscribeGlobally(func(event core.Event) {
		if len(event.Type) < 6 || event.Type[:6] != "agent:" {
			return
		}
		msg, _ := json.Marshal(model.WSMessage{
			Type:    event.Type,
			Payload: event.Payload,
		})
		hub.BroadcastAll(msg)

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

	handler := api.New(db, hub, cfg.LlamaConfigPath, registry, scheduleStore)
	handler.SetRAG(ragSvc)
	r := handler.Router(cfg)

	aiClient := ai.New(cfg.AIAPIKey, cfg.AIEndpoint, cfg.AIModel)
	r = api.AIContextMiddleware(aiClient)(r)
	if cfg.AIAPIKey != "" {
		log.Printf("AI service initialized with model: %s", cfg.AIModel)
	} else {
		log.Println("AI service started in dynamic mode — use POST /api/v1/ai/provider to configure")
	}

	// Activate the full router — health endpoint now returns 200.
	atomicRouter.Store(routerHolder{h: r})
	log.Printf("API: http://localhost%s/api/v1", addr)
	log.Printf("WebSocket: ws://localhost%s/ws", addr)

	// --- Graceful shutdown ---
	<-quit
	log.Println("Shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("forced shutdown: %v", err)
	}
	log.Println("Server stopped")
}

func findFreePort(preferred string, fallbacks ...int) string {
	for _, p := range append([]string{preferred}, intSliceToStrings(fallbacks)...) {
		ln, err := net.Listen("tcp", ":"+p)
		if err == nil {
			_ = ln.Close()
			return p
		}
	}
	return preferred
}

func intSliceToStrings(ports []int) []string {
	s := make([]string, len(ports))
	for i, p := range ports {
		s[i] = fmt.Sprintf("%d", p)
	}
	return s
}
