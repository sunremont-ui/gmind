package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gmind/backend/internal/agent"
	"github.com/gmind/backend/internal/core"
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
	r.Get("/agents", h.ListAgents)
	r.Post("/agents", h.CreateAgent)
	r.Delete("/agents/{id}", h.DeleteAgent)

	// Task endpoints
	r.Post("/agents/{id}/tasks", h.SubmitTask)
	r.Get("/tasks", h.ListTasks)
	r.Get("/tasks/{taskID}", h.GetTask)
	r.Post("/tasks/{taskID}/approve", h.ApproveTask)
	r.Post("/tasks/{taskID}/reject", h.RejectTask)

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
		Role     string `json:"role"`
		Provider string `json:"provider"`
		Model    string `json:"model"`
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
		ID:       "agent-" + generateShortID(),
		Role:     req.Role,
		Status:   agent.StatusIdle,
		Provider: req.Provider,
		Model:    req.Model,
	}
	if err := h.module.Registry().Register(info); err != nil {
		writeError(w, http.StatusConflict, err.Error())
		return
	}

	// Auto-start worker for this agent
	if h.module.WorkerPool != nil {
		h.module.WorkerPool.StartWorker(info)
	}

	writeJSON(w, http.StatusCreated, info)
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

	h.module.Registry().Unregister(id)
	writeJSON(w, http.StatusNoContent, nil)
}

type submitTaskRequest struct {
	Action         string         `json:"action"`
	Params         map[string]any `json:"params,omitempty"`
	WorkbookID     string         `json:"workbook_id,omitempty"`
	SheetID        string         `json:"sheet_id,omitempty"`
	TopicID        string         `json:"topic_id,omitempty"`
	IdempotencyKey string         `json:"idempotency_key,omitempty"`
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

	taskID, err := h.module.Manager().SubmitTask(agentID, req.Action, req.Params, req.WorkbookID, req.SheetID, req.TopicID, ik)
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
