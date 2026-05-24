package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
)

// AgentTaskRecord represents a persisted agent task.
type AgentTaskRecord struct {
	ID              string          `json:"id"`
	AgentID         string          `json:"agent_id"`
	Action          string          `json:"action"`
	Params          json.RawMessage `json:"params,omitempty"`
	WorkbookID      string          `json:"workbook_id,omitempty"`
	SheetID         string          `json:"sheet_id,omitempty"`
	TopicID         string          `json:"topic_id,omitempty"`
	Status          string          `json:"status"`
	Result          json.RawMessage `json:"result,omitempty"`
	Error           string          `json:"error,omitempty"`
	MaxCalls        int             `json:"max_calls"`
	CreatedAt       string          `json:"created_at"`
	UpdatedAt       string          `json:"updated_at"`
	IdempotencyKey  string          `json:"idempotency_key,omitempty"`
	ChainToAgentID  string          `json:"chain_to_agent_id,omitempty"`
	ChainFromTaskID string          `json:"chain_from_task_id,omitempty"`
	ParallelGroupID string          `json:"parallel_group_id,omitempty"`
}

// TaskStore provides SQLite persistence for agent tasks.
type TaskStore struct {
	db *sql.DB
}

func NewTaskStore(db *sql.DB) *TaskStore {
	return &TaskStore{db: db}
}

const taskCols = `id, agent_id, action, params, workbook_id, sheet_id, topic_id, status, result, error_text, max_calls, created_at, updated_at, idempotency_key, chain_to_agent_id, chain_from_task_id, parallel_group_id`

func (ts *TaskStore) scanTask(scanner interface {
	Scan(dest ...any) error
}) (*AgentTaskRecord, error) {
	t := &AgentTaskRecord{}
	var paramsStr, resultStr string
	err := scanner.Scan(&t.ID, &t.AgentID, &t.Action, &paramsStr, &t.WorkbookID, &t.SheetID, &t.TopicID, &t.Status, &resultStr, &t.Error, &t.MaxCalls, &t.CreatedAt, &t.UpdatedAt, &t.IdempotencyKey, &t.ChainToAgentID, &t.ChainFromTaskID, &t.ParallelGroupID)
	if err != nil {
		return nil, err
	}
	t.Params = json.RawMessage(paramsStr)
	if resultStr != "" {
		t.Result = json.RawMessage(resultStr)
	}
	return t, nil
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
		`INSERT INTO agent_tasks (`+taskCols+`)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.AgentID, t.Action, paramsJSON, t.WorkbookID, t.SheetID, t.TopicID,
		t.Status, resultJSON, t.Error, t.MaxCalls, t.CreatedAt, t.UpdatedAt, t.IdempotencyKey,
		t.ChainToAgentID, t.ChainFromTaskID, t.ParallelGroupID,
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
		rows, err = ts.db.Query(`SELECT `+taskCols+` FROM agent_tasks WHERE agent_id = ? ORDER BY created_at DESC`, agentID)
	} else {
		rows, err = ts.db.Query(`SELECT `+taskCols+` FROM agent_tasks ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*AgentTaskRecord
	for rows.Next() {
		t, err := ts.scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (ts *TaskStore) Get(id string) (*AgentTaskRecord, error) {
	t, err := ts.scanTask(ts.db.QueryRow(
		`SELECT `+taskCols+` FROM agent_tasks WHERE id = ?`, id,
	))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("task %s not found", id)
		}
		return nil, err
	}
	return t, nil
}

func (ts *TaskStore) LoadQueued() ([]*AgentTaskRecord, error) {
	rows, err := ts.db.Query(`SELECT `+taskCols+` FROM agent_tasks WHERE status IN ('queued', 'running') ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []*AgentTaskRecord
	for rows.Next() {
		t, err := ts.scanTask(rows)
		if err != nil {
			return nil, err
		}
		if t.Status == "running" {
			t.Status = "queued"
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (ts *TaskStore) GetByIDempotencyKey(key string) (*AgentTaskRecord, error) {
	t, err := ts.scanTask(ts.db.QueryRow(
		`SELECT `+taskCols+` FROM agent_tasks WHERE idempotency_key = ? AND idempotency_key != ''`, key,
	))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return t, nil
}

func (ts *TaskStore) ResetRunning() error {
	_, err := ts.db.Exec(`UPDATE agent_tasks SET status = 'queued', updated_at = ? WHERE status = 'running'`, time.Now().UTC().Format(time.RFC3339))
	return err
}
