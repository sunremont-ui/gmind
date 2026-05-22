package agent

import (
	"context"
	"sync"
	"time"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/rag"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/wiki"
	openai "github.com/sashabaranov/go-openai"
)

// WorkerPool manages goroutine workers that pull and execute tasks.
type WorkerPool struct {
	mu       sync.RWMutex
	workers  map[string]context.CancelFunc // agentID → cancel
	queue    *TaskQueue
	manager  *Manager
	executor *ToolExecutor
	prompts  *PromptStore
	logger   core.Logger
	eventBus core.EventBus
	provider LLMProvider
	model    string
}

// NewWorkerPool creates a new worker pool.
func NewWorkerPool(
	taskQueue *TaskQueue,
	s *store.Store,
	prompts *PromptStore,
	logger core.Logger,
	eventBus core.EventBus,
	wikiStore *wiki.Store,
	manager *Manager,
) *WorkerPool {
	exec := NewToolExecutor(s, eventBus, logger, wikiStore)
	exec.SetManager(manager)
	return &WorkerPool{
		workers:  make(map[string]context.CancelFunc),
		queue:    taskQueue,
		manager:  manager,
		executor: exec,
		prompts:  prompts,
		logger:   logger,
		eventBus: eventBus,
	}
}

// SetAIEndpoint updates the AI client used by workers.
func (wp *WorkerPool) SetAIEndpoint(apiKey, baseURL, modelName string) {
	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}
	wp.mu.Lock()
	defer wp.mu.Unlock()
	client := openai.NewClientWithConfig(config)
	wp.provider = NewOpenAIProvider(client, modelName)
	wp.model = modelName
}

// SetYandexEndpoint configures the worker pool to use YandexGPT.
func (wp *WorkerPool) SetYandexEndpoint(apiKey, folderID, modelName string) {
	wp.mu.Lock()
	defer wp.mu.Unlock()
	wp.provider = NewYandexGPTProvider(apiKey, folderID, modelName)
	wp.model = modelName
}

// SetMaSysBaseURL propagates the MASys base URL into the tool executor.
func (wp *WorkerPool) SetMaSysBaseURL(url string) {
	wp.executor.SetMaSysBaseURL(url)
}

// SetRAG wires a RAG service into the tool executor for semantic_search support.
func (wp *WorkerPool) SetRAG(svc *rag.Service) {
	wp.executor.SetRAG(svc)
}

// StartWorker starts a background goroutine for an agent.
func (wp *WorkerPool) StartWorker(agentInfo *AgentInfo) {
	wp.mu.Lock()
	defer wp.mu.Unlock()

	if cancel, ok := wp.workers[agentInfo.ID]; ok {
		cancel()
	}

	ctx, cancel := context.WithCancel(context.Background())
	wp.workers[agentInfo.ID] = cancel

	go wp.runWorkerLoop(ctx, agentInfo)
	wp.logger.Info("worker started", "id", agentInfo.ID, "role", agentInfo.Role)
}

// StopWorker stops the worker goroutine for an agent.
func (wp *WorkerPool) StopWorker(agentID string) {
	wp.mu.Lock()
	defer wp.mu.Unlock()
	if cancel, ok := wp.workers[agentID]; ok {
		cancel()
		delete(wp.workers, agentID)
		wp.logger.Info("worker stopped", "id", agentID)
	}
}

// StopAll stops all workers.
func (wp *WorkerPool) StopAll() {
	wp.mu.Lock()
	defer wp.mu.Unlock()
	for id, cancel := range wp.workers {
		cancel()
		delete(wp.workers, id)
	}
	wp.logger.Info("all workers stopped")
}

// SubmitScheduled dispatches a scheduled task directly to a worker without going through the queue.
func (wp *WorkerPool) SubmitScheduled(t *model.ScheduledTask) {
	wp.mu.RLock()
	provider := wp.provider
	modelName := wp.model
	manager := wp.manager
	wp.mu.RUnlock()

	if provider == nil {
		wp.logger.Warn("cannot dispatch scheduled task: AI endpoint not configured", "task_id", t.ID)
		return
	}

	// Convert ScheduledTask into a Task for the executor
	task := &Task{
		ID:         t.ID,
		AgentID:    t.AgentID,
		Action:     "scheduled_task",
		Params:     map[string]any{"input": t.TaskInput},
		WorkbookID: "",
	}

	ag := manager.registry.Get(t.AgentID)
	if ag == nil {
		wp.logger.Warn("agent not found for scheduled task", "task_id", t.ID, "agent_id", t.AgentID)
		return
	}

	// Start worker if not already running
	wp.StartWorker(ag)

	// Use per-agent model override when set
	if ag.Model != "" {
		modelName = ag.Model
	}

	go RunTask(context.Background(), provider, modelName, ag, wp.executor, wp.prompts, wp.queue, wp.eventBus, wp.logger, manager, task.ID)
}

// WorkerCount returns the number of active workers.
func (wp *WorkerPool) WorkerCount() int {
	wp.mu.Lock()
	defer wp.mu.Unlock()
	return len(wp.workers)
}

func (wp *WorkerPool) runWorkerLoop(ctx context.Context, agentInfo *AgentInfo) {
	// Try once immediately, then wait for signal or poll fallback
	poll := time.NewTicker(5 * time.Second)
	defer poll.Stop()

	for {
		// Process all available tasks before waiting
		for wp.tryProcessTask(ctx, agentInfo) {
		}

		select {
		case <-ctx.Done():
			return
		case <-wp.queue.Signal():
			// Woken up — a new task was enqueued
		case <-poll.C:
			// Fallback poll for safety
		}
	}
}

// tryProcessTask attempts to dequeue and run one task. Returns true if a task was found.
func (wp *WorkerPool) tryProcessTask(ctx context.Context, agentInfo *AgentInfo) bool {
	task := wp.queue.Dequeue(agentInfo.ID)
	if task == nil {
		return false
	}

	wp.mu.RLock()
	provider := wp.provider
	model := wp.model
	manager := wp.manager
	wp.mu.RUnlock()

	if provider == nil {
		wp.queue.Fail(task.ID, &errNoAI{})
		return true
	}

	// Use per-agent model override when set
	if agentInfo.Model != "" {
		model = agentInfo.Model
	}

	go RunTask(ctx, provider, model, agentInfo, wp.executor, wp.prompts, wp.queue, wp.eventBus, wp.logger, manager, task.ID)
	return true
}

type errNoAI struct{}

func (e *errNoAI) Error() string {
	return "AI endpoint not configured: call SetAIEndpoint first"
}
