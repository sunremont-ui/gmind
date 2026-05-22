package agent

import (
	"context"
	"fmt"
	"sync"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/store"
)


const (
	ModuleID      = "agent"
	ModuleName    = "Agent System"
	ModuleVersion = "0.2.0"
)

// Module implements core.Module for the multi-agent system.
type Module struct {
	mu       sync.RWMutex
	health   core.HealthStatus
	registry *Registry
	manager  *Manager
	eventBus core.EventBus
	logger   core.Logger
	store    core.Store

	// SQLite-backed task store (set after Init via InitTaskStore)
	taskStore *store.TaskStore

	// SQLite-backed agent store (set after Init via InitAgentStore)
	agentStore *store.AgentStore

	// Prompt store with configurable prompts
	PromptStore *PromptStore

	// Task queue
	TaskQueue *TaskQueue

	// Worker pool
	WorkerPool *WorkerPool

	// Scheduler for cron-based task execution
	Scheduler *Scheduler

	// unsubscribe functions for event subscriptions
	unsubs []func()
}

// NewModule creates a new agent module.
func NewModule() *Module {
	return &Module{
		health: core.HealthUnknown,
	}
}

func (m *Module) ID() string                { return ModuleID }
func (m *Module) Name() string              { return ModuleName }
func (m *Module) Version() string           { return ModuleVersion }
func (m *Module) Dependencies() []string    { return nil }
func (m *Module) Health() core.HealthStatus { return m.health }

func (m *Module) Init(ctx context.Context, deps *core.Dependencies) error {
	m.eventBus = deps.EventBus
	m.logger = deps.Logger
	m.store = deps.Store

	promptPath := ""
	if deps.Config != nil {
		promptPath = deps.Config.Get("agent_prompts_file")
	}
	m.PromptStore = NewPromptStore(promptPath)

	m.registry = NewRegistry(deps.Logger)
	// TaskQueue created without TaskStore initially; InitTaskStore sets it later.
	m.TaskQueue = NewTaskQueue(nil, deps.Logger)
	m.manager = NewManager(m.registry, m.TaskQueue, deps.Logger)
	deps.Logger.Info("agent module initialized")
	return nil
}

// InitTaskStore sets the SQLite-backed task store (called from main.go after DB is available).
func (m *Module) InitTaskStore(ts *store.TaskStore) {
	m.taskStore = ts
	// Recreate TaskQueue with persistence and update Manager's reference.
	m.TaskQueue = NewTaskQueue(ts, m.logger)
	m.manager.taskQueue = m.TaskQueue
}

// InitAgentStore loads persisted agents from SQLite into the Registry.
// Workers are NOT started here — call wp.StartWorker for each Registry().List() entry after WorkerPool is set.
func (m *Module) InitAgentStore(as *store.AgentStore) {
	m.agentStore = as
	records, err := as.List()
	if err != nil {
		m.logger.Info("failed to load agents from store", "err", err)
		return
	}
	for _, rec := range records {
		info := &AgentInfo{
			ID:           rec.ID,
			Name:         rec.Name,
			Role:         rec.Role,
			Status:       StatusIdle,
			Provider:     rec.Provider,
			Model:        rec.Model,
			SystemPrompt: rec.SystemPrompt,
		}
		if err := m.registry.Register(info); err != nil {
			m.logger.Info("agent already registered, skipping", "id", rec.ID)
		}
	}
	m.logger.Info("agents loaded from store", "count", len(records))
}

// PersistAgent inserts a newly created agent into the store.
func (m *Module) PersistAgent(info *AgentInfo) error {
	if m.agentStore == nil {
		return nil
	}
	return m.agentStore.Insert(&store.AgentRecord{
		ID:           info.ID,
		Name:         info.Name,
		Role:         info.Role,
		Provider:     info.Provider,
		Model:        info.Model,
		SystemPrompt: info.SystemPrompt,
	})
}

// RemoveAgent unregisters an agent from the Registry and deletes it from the store.
func (m *Module) RemoveAgent(id string) {
	m.registry.Unregister(id)
	if m.agentStore != nil {
		_ = m.agentStore.Delete(id)
	}
}

// SyncAgent updates a modified agent's fields in the store.
func (m *Module) SyncAgent(info *AgentInfo) error {
	if m.agentStore == nil {
		return nil
	}
	return m.agentStore.Update(&store.AgentRecord{
		ID:           info.ID,
		Name:         info.Name,
		Role:         info.Role,
		Provider:     info.Provider,
		Model:        info.Model,
		SystemPrompt: info.SystemPrompt,
	})
}

// InitScheduler initializes the cron scheduler with a scheduled task store.
func (m *Module) InitScheduler(schedStore *store.ScheduledTaskStore, workerPool *WorkerPool) {
	m.Scheduler = NewScheduler(schedStore, m.TaskQueue, workerPool, m.logger, m.eventBus)
}

func (m *Module) Start(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Subscribe to topic events for agent triggers
	unsub1 := m.eventBus.Subscribe("topic:created", m.handleTopicCreated)
	unsub2 := m.eventBus.Subscribe("topic:updated", m.handleTopicUpdated)
	m.unsubs = append(m.unsubs, unsub1, unsub2)

	m.health = core.HealthHealthy
	m.logger.Info("agent module started")
	return nil
}

func (m *Module) Stop(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, unsub := range m.unsubs {
		unsub()
	}
	m.unsubs = nil
	if m.WorkerPool != nil {
		m.WorkerPool.StopAll()
	}
	m.manager.StopAll()
	m.health = core.HealthUnknown
	m.logger.Info("agent module stopped")
	return nil
}

// SetAIEndpoint configures the worker pool's AI client.
func (m *Module) SetAIEndpoint(apiKey, baseURL, modelName string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.WorkerPool != nil {
		m.WorkerPool.SetAIEndpoint(apiKey, baseURL, modelName)
		m.logger.Info("AI endpoint updated for agent workers",
			"model", modelName, "base_url", baseURL)
	}
}

// SetYandexEndpoint configures the worker pool to use YandexGPT.
func (m *Module) SetYandexEndpoint(apiKey, folderID, modelName string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.WorkerPool != nil {
		m.WorkerPool.SetYandexEndpoint(apiKey, folderID, modelName)
		m.logger.Info("YandexGPT endpoint updated for agent workers",
			"model", modelName, "folder_id", folderID)
	}
}

func (m *Module) handleTopicCreated(event core.Event) {
	m.logger.Debug("topic created event", "payload", event.Payload)
}

func (m *Module) handleTopicUpdated(event core.Event) {
	m.logger.Debug("topic updated event", "payload", event.Payload)
}

// Registry returns the agent registry (for HTTP handlers).
func (m *Module) Registry() *Registry {
	return m.registry
}

// Manager returns the agent manager (for HTTP handlers).
func (m *Module) Manager() *Manager {
	return m.manager
}

// --- Agent Registry ---

type AgentStatus string

const (
	StatusIdle    AgentStatus = "idle"
	StatusWorking AgentStatus = "working"
	StatusError   AgentStatus = "error"
)

type AgentInfo struct {
	ID           string      `json:"id"`
	Name         string      `json:"name,omitempty"`
	Role         string      `json:"role"`
	Status       AgentStatus `json:"status"`
	Provider     string      `json:"provider"`
	Model        string      `json:"model"`
	SystemPrompt string      `json:"system_prompt,omitempty"`
}

type Registry struct {
	mu     sync.RWMutex
	agents map[string]*AgentInfo
	logger core.Logger
}

func NewRegistry(logger core.Logger) *Registry {
	return &Registry{
		agents: make(map[string]*AgentInfo),
		logger: logger,
	}
}

func (r *Registry) Register(agent *AgentInfo) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.agents[agent.ID]; exists {
		return fmt.Errorf("agent %s already registered", agent.ID)
	}
	r.agents[agent.ID] = agent
	r.logger.Info("agent registered", "id", agent.ID, "role", agent.Role)
	return nil
}

func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.agents, id)
	r.logger.Info("agent unregistered", "id", id)
}

func (r *Registry) Get(id string) *AgentInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.agents[id]
}

func (r *Registry) List() []*AgentInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]*AgentInfo, 0, len(r.agents))
	for _, a := range r.agents {
		result = append(result, a)
	}
	return result
}

// --- Agent Manager ---

type Manager struct {
	registry     *Registry
	taskQueue    *TaskQueue
	logger       core.Logger
	HITALEnabled bool // Human-in-the-loop: mutating tasks require approval
}

func NewManager(registry *Registry, taskQueue *TaskQueue, logger core.Logger) *Manager {
	return &Manager{registry: registry, taskQueue: taskQueue, logger: logger}
}

// SubmitTask enqueues a task for a specific agent and returns the task ID.
// If HITALEnabled is true and the action is mutating, the task is created in pending_approval.
// If idempotencyKey is non-empty and a task with that key exists, the existing task ID is returned.
func (m *Manager) SubmitTask(agentID, action string, params map[string]any, workbookID, sheetID, topicID, idempotencyKey, chainToAgentID, chainFromTaskID string) (string, error) {
	ag := m.registry.Get(agentID)
	if ag == nil {
		return "", fmt.Errorf("agent %s not found", agentID)
	}

	task := &Task{
		AgentID:         agentID,
		Action:          action,
		Params:          params,
		WorkbookID:      workbookID,
		SheetID:         sheetID,
		TopicID:         topicID,
		MaxCalls:        10,
		IdempotencyKey:  idempotencyKey,
		ChainToAgentID:  chainToAgentID,
		ChainFromTaskID: chainFromTaskID,
	}

	initialStatus := TaskQueued
	if m.HITALEnabled && isMutatingAction(action) {
		initialStatus = TaskPendingApproval
	}

	if err := m.taskQueue.Enqueue(task, initialStatus); err != nil {
		return "", err
	}

	ag.Status = StatusWorking
	m.logger.Info("task submitted", "id", task.ID, "agent", agentID, "action", action, "status", initialStatus)
	return task.ID, nil
}

func isMutatingAction(action string) bool {
	switch action {
	case "generate", "expand", "restructure", "edit", "create_topic", "update_topic", "add_note":
		return true
	}
	return false
}

func (m *Manager) StopAll() {
	m.logger.Info("stopping all agents")
}

// StartWorker starts a background worker for an agent.
func (m *Manager) StartWorker(agentID string, pool *WorkerPool) {
	agent := m.registry.Get(agentID)
	if agent == nil {
		return
	}
	pool.StartWorker(agent)
}

// GetTask retrieves a task by ID (used by delegate_to_agent for polling).
func (m *Manager) GetTask(id string) (*Task, error) {
	return m.taskQueue.Get(id)
}

// UpdateModel updates the model and optionally provider for an agent.
func (m *Manager) UpdateModel(agentID, provider, model string) error {
	ag := m.registry.Get(agentID)
	if ag == nil {
		return fmt.Errorf("agent %s not found", agentID)
	}
	ag.Provider = provider
	ag.Model = model
	m.logger.Info("agent model updated", "id", agentID, "provider", provider, "model", model)
	return nil
}
