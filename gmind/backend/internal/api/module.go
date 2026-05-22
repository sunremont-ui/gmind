package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gmind/backend/internal/agent"
	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

// AgentHandler provides HTTP handlers for the agent subsystem.
type AgentHandler struct {
	store    *store.Store
	module   *agent.Module
	registry *core.Registry
}

func NewAgentHandler(s *store.Store, module *agent.Module, registry *core.Registry) *AgentHandler {
	return &AgentHandler{
		store:    s,
		module:   module,
		registry: registry,
	}
}

func (h *AgentHandler) RegisterRoutes(r chiRouter) {
	r.Get("/", h.ListAgents)
	r.Post("/", h.CreateAgent)
	r.Delete("/{id}", h.DeleteAgent)
	r.Patch("/{id}", h.UpdateAgent)
	r.Post("/{id}/stop", h.StopAgent)

	// Task endpoints
	r.Post("/{id}/tasks", h.SubmitTask)
	r.Get("/tasks", h.ListTasks)
	r.Get("/tasks/{taskID}", h.GetTask)
	r.Post("/tasks/{taskID}/approve", h.ApproveTask)
	r.Post("/tasks/{taskID}/reject", h.RejectTask)

	// Comment endpoints
	r.Get("/topics/{topicID}/comments", h.ListComments)
	r.Post("/topics/{topicID}/comments", h.CreateComment)
	r.Delete("/comments/{id}", h.DeleteComment)

	// Task log endpoints (SSE streaming + REST history)
	r.Get("/tasks/{taskID}/stream", h.StreamTaskLogs)
	r.Get("/tasks/{taskID}/logs", h.GetTaskLogs)
}

func (h *AgentHandler) ListAgents(w http.ResponseWriter, r *http.Request) {
	if h.module == nil {
		writeJSON(w, http.StatusOK, []*agent.AgentInfo{})
		return
	}
	writeJSON(w, http.StatusOK, h.module.Registry().List())
}

func (h *AgentHandler) CreateAgent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Role         string `json:"role"`
		Provider     string `json:"provider"`
		Model        string `json:"model"`
		Name         string `json:"name"`
		SystemPrompt string `json:"system_prompt"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Role == "" {
		writeError(w, http.StatusBadRequest, "role is required")
		return
	}

	info := &agent.AgentInfo{
		ID:           "agent-" + generateShortID(),
		Name:         req.Name,
		Role:         req.Role,
		Status:       agent.StatusIdle,
		Provider:     req.Provider,
		Model:        req.Model,
		SystemPrompt: req.SystemPrompt,
	}
	if err := h.module.Registry().Register(info); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}

	// Persist to SQLite
	if err := h.module.PersistAgent(info); err != nil {
		// Non-fatal: agent is in-memory, log and continue
		_ = err
	}

	// Auto-start worker for this agent
	if h.module.WorkerPool != nil {
		h.module.WorkerPool.StartWorker(info)
	}

	writeJSON(w, http.StatusCreated, info)
}

func (h *AgentHandler) StopAgent(w http.ResponseWriter, r *http.Request) {
	id := extractPathParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}
	if h.module == nil {
		writeError(w, http.StatusServiceUnavailable, "agent module not available")
		return
	}
	ag := h.module.Registry().Get(id)
	if ag == nil {
		writeError(w, http.StatusNotFound, "agent not found")
		return
	}
	ag.Status = agent.StatusIdle
	// Restart worker loop so it's ready for new tasks (cancels any in-flight context)
	if h.module.WorkerPool != nil {
		h.module.WorkerPool.StartWorker(ag)
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *AgentHandler) DeleteAgent(w http.ResponseWriter, r *http.Request) {
	id := extractPathParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	// Stop worker if running
	if h.module.WorkerPool != nil {
		h.module.WorkerPool.StopWorker(id)
	}

	// Unregister from Registry + delete from store
	h.module.RemoveAgent(id)
	writeJSON(w, http.StatusNoContent, nil)
}

func (h *AgentHandler) UpdateAgent(w http.ResponseWriter, r *http.Request) {
	id := extractPathParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	var req struct {
		Provider     string `json:"provider,omitempty"`
		Model        string `json:"model,omitempty"`
		SystemPrompt *string `json:"system_prompt,omitempty"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	ag := h.module.Registry().Get(id)
	if ag == nil {
		writeError(w, http.StatusNotFound, "agent not found")
		return
	}

	if req.Provider != "" {
		ag.Provider = req.Provider
	}
	if req.Model != "" {
		ag.Model = req.Model
	}
	if req.SystemPrompt != nil {
		ag.SystemPrompt = *req.SystemPrompt
	}

	if req.Provider != "" || req.Model != "" {
		if err := h.module.Manager().UpdateModel(id, ag.Provider, ag.Model); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
	}

	// Sync changes to SQLite
	_ = h.module.SyncAgent(ag)

	writeJSON(w, http.StatusOK, ag)
}

type submitTaskRequest struct {
	Action          string         `json:"action"`
	Params          map[string]any `json:"params,omitempty"`
	WorkbookID      string         `json:"workbook_id,omitempty"`
	SheetID         string         `json:"sheet_id,omitempty"`
	TopicID         string         `json:"topic_id,omitempty"`
	IdempotencyKey  string         `json:"idempotency_key,omitempty"`
	ChainToAgentID  string         `json:"chain_to_agent_id,omitempty"`
	ChainFromTaskID string         `json:"chain_from_task_id,omitempty"`
}

func (h *AgentHandler) SubmitTask(w http.ResponseWriter, r *http.Request) {
	agentID := extractPathParam(r, "id")
	if agentID == "" {
		writeError(w, http.StatusBadRequest, "agent id is required")
		return
	}

	var req submitTaskRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Action == "" {
		writeError(w, http.StatusBadRequest, "action is required")
		return
	}

	// Also check Idempotency-Key header
	ik := req.IdempotencyKey
	if ik == "" {
		ik = r.Header.Get("Idempotency-Key")
	}

	taskID, err := h.module.Manager().SubmitTask(agentID, req.Action, req.Params, req.WorkbookID, req.SheetID, req.TopicID, ik, req.ChainToAgentID, req.ChainFromTaskID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"task_id": taskID})
}

func (h *AgentHandler) ListTasks(w http.ResponseWriter, r *http.Request) {
	if h.module == nil || h.module.TaskQueue == nil {
		writeJSON(w, http.StatusOK, []*agent.Task{})
		return
	}
	agentID := r.URL.Query().Get("agent_id")
	writeJSON(w, http.StatusOK, h.module.TaskQueue.List(agentID))
}

func (h *AgentHandler) GetTask(w http.ResponseWriter, r *http.Request) {
	taskID := extractPathParam(r, "taskID")
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "task id is required")
		return
	}
	if h.module == nil || h.module.TaskQueue == nil {
		writeError(w, http.StatusNotFound, "module not available")
		return
	}
	task, err := h.module.TaskQueue.Get(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, task)
}

func (h *AgentHandler) ApproveTask(w http.ResponseWriter, r *http.Request) {
	taskID := extractPathParam(r, "taskID")
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "task id is required")
		return
	}
	if h.module == nil || h.module.TaskQueue == nil {
		writeError(w, http.StatusNotFound, "module not available")
		return
	}
	if err := h.module.TaskQueue.ApproveTask(taskID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "approved"})
}

func (h *AgentHandler) RejectTask(w http.ResponseWriter, r *http.Request) {
	taskID := extractPathParam(r, "taskID")
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "task id is required")
		return
	}
	if h.module == nil || h.module.TaskQueue == nil {
		writeError(w, http.StatusNotFound, "module not available")
		return
	}
	if err := h.module.TaskQueue.RejectTask(taskID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "rejected"})
}

func (h *AgentHandler) ListComments(w http.ResponseWriter, r *http.Request) {
	topicID := extractPathParam(r, "topicID")
	if topicID == "" {
		writeError(w, http.StatusBadRequest, "topic_id is required")
		return
	}
	cs := h.store.CommentStore()
	comments, err := cs.ListByTopic(topicID)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, comments)
}

func (h *AgentHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	topicID := extractPathParam(r, "topicID")
	if topicID == "" {
		writeError(w, http.StatusBadRequest, "topic_id is required")
		return
	}

	var req model.CreateCommentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Content == "" {
		writeError(w, http.StatusBadRequest, "content is required")
		return
	}

	userID := r.Header.Get("X-User-ID")

	cs := h.store.CommentStore()
	comment := &model.Comment{
		ID:      "cmt-" + generateShortID(),
		TopicID: topicID,
		UserID:  userID,
		Content: req.Content,
	}
	if err := cs.Create(comment); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, comment)
}

func (h *AgentHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	id := extractPathParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	cs := h.store.CommentStore()
	if err := cs.Delete(id); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// Helper functions used by module handlers.

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func extractPathParam(r *http.Request, key string) string {
	return chi.URLParam(r, key)
}

func generateShortID() string {
	return fmt.Sprintf("%x", time.Now().UnixNano())[:12]
}
