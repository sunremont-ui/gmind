package agent

import (
	"context"
	"sync"
	"time"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/wiki"
	openai "github.com/sashabaranov/go-openai"
)

// WorkerPool manages goroutine workers that pull and execute tasks.
type WorkerPool struct {
	mu        sync.RWMutex
	workers   map[string]context.CancelFunc // agentID → cancel
	taskQueue *TaskQueue
	executor  *ToolExecutor
	prompts   *PromptStore
	logger    core.Logger
	eventBus  core.EventBus
	provider  LLMProvider
	model     string
}

// NewWorkerPool creates a new worker pool.
func NewWorkerPool(
	taskQueue *TaskQueue,
	s *store.Store,
	prompts *PromptStore,
	logger core.Logger,
	eventBus core.EventBus,
	wikiStore *wiki.Store,
) *WorkerPool {
	return &WorkerPool{
		workers:   make(map[string]context.CancelFunc),
		taskQueue: taskQueue,
		executor:  NewToolExecutor(s, eventBus, logger, wikiStore),
		prompts:   prompts,
		logger:    logger,
		eventBus:  eventBus,
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
		case <-wp.taskQueue.Signal():
			// Woken up — a new task was enqueued
		case <-poll.C:
			// Fallback poll for safety
		}
	}
}

// tryProcessTask attempts to dequeue and run one task. Returns true if a task was found.
func (wp *WorkerPool) tryProcessTask(ctx context.Context, agentInfo *AgentInfo) bool {
	task := wp.taskQueue.Dequeue(agentInfo.ID)
	if task == nil {
		return false
	}

	wp.mu.RLock()
	provider := wp.provider
	model := wp.model
	wp.mu.RUnlock()

	if provider == nil {
		wp.taskQueue.Fail(task.ID, &errNoAI{})
		return true
	}

	go RunTask(ctx, provider, model, agentInfo, wp.executor, wp.prompts, wp.taskQueue, wp.eventBus, wp.logger, task.ID)
	return true
}

type errNoAI struct{}

func (e *errNoAI) Error() string {
	return "AI endpoint not configured: call SetAIEndpoint first"
}
