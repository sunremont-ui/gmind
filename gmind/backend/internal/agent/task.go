package agent

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/store"
	"github.com/google/uuid"
)

type TaskStatus string

const (
	TaskQueued          TaskStatus = "queued"
	TaskRunning         TaskStatus = "running"
	TaskDone            TaskStatus = "done"
	TaskFailed          TaskStatus = "failed"
	TaskPendingApproval TaskStatus = "pending_approval"
)

type Task struct {
	ID              string          `json:"id"`
	AgentID         string          `json:"agent_id"`
	Action          string          `json:"action"`
	Params          map[string]any  `json:"params"`
	WorkbookID      string          `json:"workbook_id"`
	SheetID         string          `json:"sheet_id,omitempty"`
	TopicID         string          `json:"topic_id,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
	Status          TaskStatus      `json:"status"`
	Result          json.RawMessage `json:"result,omitempty"`
	Error           string          `json:"error,omitempty"`
	MaxCalls        int             `json:"max_calls"`
	IdempotencyKey  string          `json:"idempotency_key,omitempty"`
	ChainToAgentID  string          `json:"chain_to_agent_id,omitempty"`
	ChainFromTaskID string          `json:"chain_from_task_id,omitempty"`
	ParallelGroupID string          `json:"parallel_group_id,omitempty"`
}

const maxDone = 500

// TaskQueue is a FIFO queue per agent with SQLite persistence.
type TaskQueue struct {
	mu         sync.Mutex
	tasks      map[string][]*Task // agentID → queue (pending/running)
	done       map[string]*Task   // completed/failed tasks by ID (capped at maxDone)
	doneOrder  []string           // insertion-order IDs for FIFO eviction
	idempotent map[string]string  // in-memory idempotency key → task ID
	ts         *store.TaskStore
	logger     core.Logger
	signal     chan struct{} // wakes up waiting workers
}

func NewTaskQueue(ts *store.TaskStore, logger core.Logger) *TaskQueue {
	q := &TaskQueue{
		tasks:      make(map[string][]*Task),
		done:       make(map[string]*Task),
		doneOrder:  make([]string, 0, maxDone),
		idempotent: make(map[string]string),
		ts:         ts,
		logger:     logger,
		signal:     make(chan struct{}, 1),
	}
	q.recover()
	return q
}

// Signal returns the wake-up channel for workers.
func (q *TaskQueue) Signal() <-chan struct{} {
	return q.signal
}

// recover loads queued/running tasks from SQLite on startup.
func (q *TaskQueue) recover() {
	if q.ts == nil {
		return
	}
	records, err := q.ts.LoadQueued()
	if err != nil {
		q.logger.Warn("failed to recover tasks", "error", err)
		return
	}
	for _, r := range records {
		params := make(map[string]any)
		if len(r.Params) > 0 {
			json.Unmarshal(r.Params, &params)
		}
		created, err := time.Parse(time.RFC3339, r.CreatedAt)
		if err != nil {
			created = time.Time{}
		}
		updated, err := time.Parse(time.RFC3339, r.UpdatedAt)
		if err != nil {
			updated = time.Time{}
		}

		var recoveredStatus TaskStatus
		switch r.Status {
		case "running":
			recoveredStatus = TaskQueued // reset running to queued on restart
		case "pending_approval":
			recoveredStatus = TaskPendingApproval
		default:
			recoveredStatus = TaskQueued
		}

		t := &Task{
			ID:              r.ID,
			AgentID:         r.AgentID,
			Action:          r.Action,
			Params:          params,
			WorkbookID:      r.WorkbookID,
			SheetID:         r.SheetID,
			TopicID:         r.TopicID,
			Status:          recoveredStatus,
			Result:          r.Result,
			Error:           r.Error,
			MaxCalls:        r.MaxCalls,
			CreatedAt:       created,
			UpdatedAt:       updated,
			ChainToAgentID:  r.ChainToAgentID,
			ChainFromTaskID: r.ChainFromTaskID,
		}
		q.tasks[t.AgentID] = append(q.tasks[t.AgentID], t)
		q.logger.Info("recovered task", "id", t.ID, "agent", t.AgentID, "action", t.Action)
	}
}

func (q *TaskQueue) Enqueue(t *Task, initialStatus ...TaskStatus) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	if t.ID == "" {
		t.ID = uuid.New().String()
	}

	// Idempotency check: if key already exists, return existing task ID
	if t.IdempotencyKey != "" {
		if existingID, ok := q.idempotent[t.IdempotencyKey]; ok {
			t.ID = existingID
			t.Status = TaskQueued
			q.logger.Debug("idempotent task reused (memory)", "key", t.IdempotencyKey, "existing_id", t.ID)
			return nil
		}
		if q.ts != nil {
			existing, err := q.ts.GetByIDempotencyKey(t.IdempotencyKey)
			if err == nil && existing != nil {
				t.ID = existing.ID
				t.Status = TaskStatus(existing.Status)
				if parsed, err := time.Parse(time.RFC3339, existing.CreatedAt); err == nil {
					t.CreatedAt = parsed
				}
				if parsed, err := time.Parse(time.RFC3339, existing.UpdatedAt); err == nil {
					t.UpdatedAt = parsed
				}
				q.idempotent[t.IdempotencyKey] = t.ID
				q.logger.Debug("idempotent task reused (db)", "key", t.IdempotencyKey, "existing_id", t.ID)
				return nil
			}
		}
	}

	if t.MaxCalls <= 0 {
		t.MaxCalls = 10
	}
	t.Status = TaskQueued
	if len(initialStatus) > 0 && initialStatus[0] == TaskPendingApproval {
		t.Status = TaskPendingApproval
	}
	now := time.Now().UTC()
	t.CreatedAt = now
	t.UpdatedAt = now

	// Persist to SQLite
	if q.ts != nil {
		paramsJSON, _ := json.Marshal(t.Params)
		record := &store.AgentTaskRecord{
			ID:              t.ID,
			AgentID:         t.AgentID,
			Action:          t.Action,
			Params:          paramsJSON,
			WorkbookID:      t.WorkbookID,
			SheetID:         t.SheetID,
			TopicID:         t.TopicID,
			Status:          string(t.Status),
			MaxCalls:        t.MaxCalls,
			CreatedAt:       now.Format(time.RFC3339),
			UpdatedAt:       now.Format(time.RFC3339),
			IdempotencyKey:  t.IdempotencyKey,
			ChainToAgentID:  t.ChainToAgentID,
			ChainFromTaskID: t.ChainFromTaskID,
			ParallelGroupID: t.ParallelGroupID,
		}
		if err := q.ts.Insert(record); err != nil {
			return fmt.Errorf("persist task: %w", err)
		}
	}

	if t.IdempotencyKey != "" {
		q.idempotent[t.IdempotencyKey] = t.ID
	}

	q.tasks[t.AgentID] = append(q.tasks[t.AgentID], t)
	q.logger.Debug("task enqueued", "id", t.ID, "agent", t.AgentID, "action", t.Action)

	// Wake up a waiting worker
	select {
	case q.signal <- struct{}{}:
	default:
	}

	return nil
}

// addDone inserts a completed task into the done map, evicting oldest if at cap.
// Must be called with q.mu held.
func (q *TaskQueue) addDone(t *Task) {
	if _, exists := q.done[t.ID]; !exists {
		if len(q.done) >= maxDone {
			// Evict the oldest entry from the FIFO order list.
			oldest := q.doneOrder[0]
			q.doneOrder = q.doneOrder[1:]
			delete(q.done, oldest)
		}
		q.doneOrder = append(q.doneOrder, t.ID)
	}
	q.done[t.ID] = t
}

// ApproveTask moves a pending_approval task to queued.
func (q *TaskQueue) ApproveTask(id string) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	for _, queue := range q.tasks {
		for _, t := range queue {
			if t.ID == id {
				if t.Status != TaskPendingApproval {
					return fmt.Errorf("task %s is not pending approval (status: %s)", id, t.Status)
				}
				t.Status = TaskQueued
				t.UpdatedAt = time.Now().UTC()
				if q.ts != nil {
					q.ts.UpdateStatus(id, string(t.Status), "", nil)
				}
				// Wake up worker
				select {
				case q.signal <- struct{}{}:
				default:
				}
				return nil
			}
		}
	}
	return fmt.Errorf("task %s not found", id)
}

// RejectTask marks a pending_approval task as failed.
func (q *TaskQueue) RejectTask(id string) error {
	q.mu.Lock()
	defer q.mu.Unlock()

	for _, queue := range q.tasks {
		for _, t := range queue {
			if t.ID == id {
				if t.Status != TaskPendingApproval {
					return fmt.Errorf("task %s is not pending approval (status: %s)", id, t.Status)
				}
				t.Status = TaskFailed
				t.Error = "rejected by user"
				t.UpdatedAt = time.Now().UTC()
				if q.ts != nil {
					q.ts.UpdateStatus(id, string(t.Status), t.Error, nil)
				}
				return nil
			}
		}
	}
	return fmt.Errorf("task %s not found", id)
}

// Dequeue picks the next task for an agent. Skips pending_approval tasks.
// The task is moved to the done map for tracking by Complete/Fail.
func (q *TaskQueue) Dequeue(agentID string) *Task {
	q.mu.Lock()
	defer q.mu.Unlock()

	queue := q.tasks[agentID]
	for i, task := range queue {
		if task.Status == TaskQueued {
			// Remove from pending queue
			q.tasks[agentID] = append(queue[:i], queue[i+1:]...)
			if len(q.tasks[agentID]) == 0 {
				delete(q.tasks, agentID)
			}

			task.Status = TaskRunning
			task.UpdatedAt = time.Now().UTC()

			if q.ts != nil {
				q.ts.UpdateStatus(task.ID, string(task.Status), "", nil)
			}

			// Track in done map so Complete/Fail can find it
			q.addDone(task)
			return task
		}
	}
	return nil
}

func (q *TaskQueue) Complete(id string, result json.RawMessage) {
	q.mu.Lock()
	defer q.mu.Unlock()

	if t, ok := q.done[id]; ok {
		t.Status = TaskDone
		t.Result = result
		t.UpdatedAt = time.Now().UTC()
		if q.ts != nil {
			q.ts.UpdateStatus(id, string(t.Status), "", result)
		}
		return
	}

	for _, queue := range q.tasks {
		for _, t := range queue {
			if t.ID == id {
				t.Status = TaskDone
				t.Result = result
				t.UpdatedAt = time.Now().UTC()
				if q.ts != nil {
					q.ts.UpdateStatus(id, string(t.Status), "", result)
				}
				q.addDone(t)
				return
			}
		}
	}
}

func (q *TaskQueue) Fail(id string, err error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	if t, ok := q.done[id]; ok {
		t.Status = TaskFailed
		t.Error = err.Error()
		t.UpdatedAt = time.Now().UTC()
		if q.ts != nil {
			q.ts.UpdateStatus(id, string(t.Status), t.Error, nil)
		}
		return
	}

	for _, queue := range q.tasks {
		for _, t := range queue {
			if t.ID == id {
				t.Status = TaskFailed
				t.Error = err.Error()
				t.UpdatedAt = time.Now().UTC()
				if q.ts != nil {
					q.ts.UpdateStatus(id, string(t.Status), t.Error, nil)
				}
				q.addDone(t)
				return
			}
		}
	}
}

func (q *TaskQueue) List(agentID string) []*Task {
	q.mu.Lock()
	defer q.mu.Unlock()

	if agentID == "" {
		all := make([]*Task, 0)
		for _, queue := range q.tasks {
			all = append(all, queue...)
		}
		for _, t := range q.done {
			all = append(all, t)
		}
		return all
	}

	result := append([]*Task{}, q.tasks[agentID]...)
	for _, t := range q.done {
		if t.AgentID == agentID {
			result = append(result, t)
		}
	}
	return result
}

func (q *TaskQueue) Get(id string) (*Task, error) {
	q.mu.Lock()
	defer q.mu.Unlock()

	if t, ok := q.done[id]; ok {
		return t, nil
	}

	for _, queue := range q.tasks {
		for _, t := range queue {
			if t.ID == id {
				return t, nil
			}
		}
	}
	return nil, fmt.Errorf("task %s not found", id)
}
