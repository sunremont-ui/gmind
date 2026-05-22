package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/gmind/backend/internal/agent"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	cron "github.com/robfig/cron/v3"
)

type ScheduleHandler struct {
	store       *store.ScheduledTaskStore
	agentModule *agent.Module
}

func NewScheduleHandler(s *store.ScheduledTaskStore, am *agent.Module) *ScheduleHandler {
	return &ScheduleHandler{store: s, agentModule: am}
}

func (h *ScheduleHandler) RegisterRoutes(r chi.Router) {
	r.Get("/", h.ListSchedule)
	r.Post("/", h.CreateSchedule)
	r.Get("/{taskID}", h.GetSchedule)
	r.Put("/{taskID}", h.UpdateSchedule)
	r.Delete("/{taskID}", h.DeleteSchedule)
	r.Post("/{taskID}/run-now", h.RunNow)
}

func (h *ScheduleHandler) ListSchedule(w http.ResponseWriter, r *http.Request) {
	agentID := chi.URLParam(r, "agentID")
	list, err := h.store.List(agentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, list)
}

func (h *ScheduleHandler) CreateSchedule(w http.ResponseWriter, r *http.Request) {
	var req model.CreateScheduledTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.AgentID == "" || req.CronExpression == "" || req.TaskInput == "" {
		writeError(w, http.StatusBadRequest, "agent_id, cron_expression and task_input are required")
		return
	}
	p := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)
	if _, err := p.Parse(req.CronExpression); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid cron expression: %v", err))
		return
	}
	now := time.Now().UTC()
	task := &model.ScheduledTask{
		ID:             uuid.New().String(),
		AgentID:        req.AgentID,
		TaskInput:      req.TaskInput,
		CronExpression: req.CronExpression,
		NextRunAt:      now,
		IsActive:       true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := h.store.Create(task); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, task)
}

func (h *ScheduleHandler) GetSchedule(w http.ResponseWriter, r *http.Request) {
	t, err := h.store.Get(chi.URLParam(r, "taskID"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *ScheduleHandler) UpdateSchedule(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "taskID")
	var req model.UpdateScheduledTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	existing, err := h.store.Get(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if req.CronExpression != "" {
		p := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)
		if _, err := p.Parse(req.CronExpression); err != nil {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("invalid cron expression: %v", err))
			return
		}
		existing.CronExpression = req.CronExpression
	}
	if req.IsActive != nil {
		existing.IsActive = *req.IsActive
	}
	nextRun, err := h.computeNextRun(existing)
	if err != nil {
		writeError(w, http.StatusBadRequest, fmt.Sprintf("failed to compute next run: %v", err))
		return
	}
	existing.NextRunAt = nextRun
	existing.UpdatedAt = time.Now().UTC()
	if err := h.store.Update(existing); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, existing)
}

func (h *ScheduleHandler) DeleteSchedule(w http.ResponseWriter, r *http.Request) {
	if err := h.store.Delete(chi.URLParam(r, "taskID")); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ScheduleHandler) RunNow(w http.ResponseWriter, r *http.Request) {
	t, err := h.store.Get(chi.URLParam(r, "taskID"))
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if h.agentModule == nil {
		writeError(w, http.StatusServiceUnavailable, "agent module not available")
		return
	}
	h.agentModule.WorkerPool.SubmitScheduled(t)
	t.LastRunAt = time.Now().UTC()
	h.store.UpdateLastRun(t.ID, t.LastRunAt)
	writeJSON(w, http.StatusOK, map[string]string{"status": "dispatched"})
}

func (h *ScheduleHandler) computeNextRun(t *model.ScheduledTask) (time.Time, error) {
	p := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)
	schedule, err := p.Parse(t.CronExpression)
	if err != nil {
		return time.Time{}, err
	}
	lastRun := t.LastRunAt
	if lastRun.IsZero() {
		lastRun = t.NextRunAt
		if lastRun.IsZero() {
			lastRun = time.Now().UTC()
		}
	}
	return schedule.Next(lastRun), nil
}
