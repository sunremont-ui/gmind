package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// AgentTaskRecord represents a persisted agent task.
type AgentTaskRecord struct {
	ID             string          `json:"id"`
	AgentID        string          `json:"agent_id"`
	Action         string          `json:"action"`
	Params         json.RawMessage `json:"params,omitempty"`
	WorkbookID     string          `json:"workbook_id,omitempty"`
	SheetID        string          `json:"sheet_id,omitempty"`
	TopicID        string          `json:"topic_id,omitempty"`
	Status         string          `json:"status"` // queued, running, done, failed
	Result         json.RawMessage `json:"result,omitempty"`
	Error          string          `json:"error,omitempty"`
	MaxCalls       int             `json:"max_calls"`
	CreatedAt      string          `json:"created_at"`
	UpdatedAt      string          `json:"updated_at"`
	IdempotencyKey string          `json:"idempotency_key,omitempty"`
}

// TaskStore provides SQLite persistence for agent tasks.
type TaskStore struct {
	db *sql.DB
}

func NewTaskStore(db *sql.DB) *TaskStore {
	return &TaskStore{db: db}
}

func (ts *TaskStore) Insert(t *AgentTaskRecord) error {
	paramsJSON := "{}"
	if t.Params != nil {
		paramsJSON = string(t.Params)
	}
	resultJSON := ""
	if t.Result != nil {
		resultJSON = string(t.Result)
	}
	_, err := ts.db.Exec(
		`INSERT INTO agent_tasks (id, agent_id, action, params, workbook_id, sheet_id, topic_id, status, result, error_text, max_calls, created_at, updated_at, idempotency_key)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.AgentID, t.Action, paramsJSON, t.WorkbookID, t.SheetID, t.TopicID,
		t.Status, resultJSON, t.Error, t.MaxCalls, t.CreatedAt, t.UpdatedAt, t.IdempotencyKey,
	)
	return err
}

func (ts *TaskStore) UpdateStatus(id, status, errorText string, result json.RawMessage) error {
	resultJSON := ""
	if result != nil {
		resultJSON = string(result)
	}
	_, err := ts.db.Exec(
		`UPDATE agent_tasks SET status = ?, result = ?, error_text = ?, updated_at = ? WHERE id = ?`,
		status, resultJSON, errorText, time.Now().UTC().Format(time.RFC3339), id,
	)
	return err
}

func (ts *TaskStore) List(agentID string) ([]*AgentTaskRecord, error) {
	var rows *sql.Rows
	var err error
	if agentID != "" {
		rows, err = ts.db.Query(`SELECT id, agent_id, action, params, workbook_id, sheet_id, topic_id, status, result, error_text, max_calls, created_at, updated_at FROM agent_tasks WHERE agent_id = ? ORDER BY created_at DESC`, agentID)
	} else {
		rows, err = ts.db.Query(`SELECT id, agent_id, action, params, workbook_id, sheet_id, topic_id, status, result, error_text, max_calls, created_at, updated_at FROM agent_tasks ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*AgentTaskRecord
	for rows.Next() {
		t := &AgentTaskRecord{}
		var paramsStr, resultStr string
		if err := rows.Scan(&t.ID, &t.AgentID, &t.Action, &paramsStr, &t.WorkbookID, &t.SheetID, &t.TopicID, &t.Status, &resultStr, &t.Error, &t.MaxCalls, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Params = json.RawMessage(paramsStr)
		if resultStr != "" {
			t.Result = json.RawMessage(resultStr)
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (ts *TaskStore) Get(id string) (*AgentTaskRecord, error) {
	t := &AgentTaskRecord{}
	var paramsStr, resultStr string
	err := ts.db.QueryRow(
		`SELECT id, agent_id, action, params, workbook_id, sheet_id, topic_id, status, result, error_text, max_calls, created_at, updated_at FROM agent_tasks WHERE id = ?`, id,
	).Scan(&t.ID, &t.AgentID, &t.Action, &paramsStr, &t.WorkbookID, &t.SheetID, &t.TopicID, &t.Status, &resultStr, &t.Error, &t.MaxCalls, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("task %s not found", id)
		}
		return nil, err
	}
	t.Params = json.RawMessage(paramsStr)
	if resultStr != "" {
		t.Result = json.RawMessage(resultStr)
	}
	return t, nil
}

// LoadQueued loads all queued and running tasks (for recovery on restart).
func (ts *TaskStore) LoadQueued() ([]*AgentTaskRecord, error) {
	rows, err := ts.db.Query(`SELECT id, agent_id, action, params, workbook_id, sheet_id, topic_id, status, result, error_text, max_calls, created_at, updated_at FROM agent_tasks WHERE status IN ('queued', 'running') ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*AgentTaskRecord
	for rows.Next() {
		t := &AgentTaskRecord{}
		var paramsStr, resultStr string
		if err := rows.Scan(&t.ID, &t.AgentID, &t.Action, &paramsStr, &t.WorkbookID, &t.SheetID, &t.TopicID, &t.Status, &resultStr, &t.Error, &t.MaxCalls, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		// Reset running tasks back to queued on restart
		if t.Status == "running" {
			t.Status = "queued"
		}
		t.Params = json.RawMessage(paramsStr)
		if resultStr != "" {
			t.Result = json.RawMessage(resultStr)
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

// GetByIDempotencyKey finds a task by its idempotency key.
func (ts *TaskStore) GetByIDempotencyKey(key string) (*AgentTaskRecord, error) {
	t := &AgentTaskRecord{}
	var paramsStr, resultStr string
	err := ts.db.QueryRow(
		`SELECT id, agent_id, action, params, workbook_id, sheet_id, topic_id, status, result, error_text, max_calls, created_at, updated_at FROM agent_tasks WHERE idempotency_key = ? AND idempotency_key != ''`, key,
	).Scan(&t.ID, &t.AgentID, &t.Action, &paramsStr, &t.WorkbookID, &t.SheetID, &t.TopicID, &t.Status, &resultStr, &t.Error, &t.MaxCalls, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.IdempotencyKey = key
	t.Params = json.RawMessage(paramsStr)
	if resultStr != "" {
		t.Result = json.RawMessage(resultStr)
	}
	return t, nil
}

// ResetRunning resets any running tasks back to queued (called on startup).
func (ts *TaskStore) ResetRunning() error {
	_, err := ts.db.Exec(`UPDATE agent_tasks SET status = 'queued', updated_at = ? WHERE status = 'running'`, time.Now().UTC().Format(time.RFC3339))
	return err
}
