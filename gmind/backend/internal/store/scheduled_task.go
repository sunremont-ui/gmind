package store

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/gmind/backend/internal/model"
)

type ScheduledTaskStore struct {
	db *sql.DB
}

func NewScheduledTaskStore(db *sql.DB) *ScheduledTaskStore {
	return &ScheduledTaskStore{db: db}
}

func (s *ScheduledTaskStore) Create(t *model.ScheduledTask) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`INSERT INTO scheduled_tasks (id, agent_id, task_input, cron_expression, next_run_at, is_active, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.AgentID, t.TaskInput, t.CronExpression, t.NextRunAt.Format(time.RFC3339), t.IsActive, now, now,
	)
	return err
}

func (s *ScheduledTaskStore) Get(id string) (*model.ScheduledTask, error) {
	t := &model.ScheduledTask{}
	var nextRunAtStr, lastRunAtStr, createdAtStr, updatedAtStr string
	err := s.db.QueryRow(
		`SELECT id, agent_id, task_input, cron_expression, next_run_at, last_run_at, result, error_text, is_active, created_at, updated_at
		 FROM scheduled_tasks WHERE id = ?`,
		id,
	).Scan(&t.ID, &t.AgentID, &t.TaskInput, &t.CronExpression, &nextRunAtStr, &lastRunAtStr, &t.Result, &t.ErrorText, &t.IsActive, &createdAtStr, &updatedAtStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("scheduled task %s not found", id)
		}
		return nil, fmt.Errorf("get scheduled task: %w", err)
	}
	t.NextRunAt, _ = time.Parse(time.RFC3339, nextRunAtStr)
	t.LastRunAt, _ = time.Parse(time.RFC3339, lastRunAtStr)
	t.CreatedAt, _ = time.Parse(time.RFC3339, createdAtStr)
	t.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAtStr)
	return t, nil
}

func (s *ScheduledTaskStore) List(agentID string) ([]*model.ScheduledTask, error) {
	var rows *sql.Rows
	var err error
	if agentID != "" {
		rows, err = s.db.Query(
			`SELECT id, agent_id, task_input, cron_expression, next_run_at, last_run_at, result, error_text, is_active, created_at, updated_at
			 FROM scheduled_tasks WHERE agent_id = ? ORDER BY created_at DESC`, agentID,
		)
	} else {
		rows, err = s.db.Query(
			`SELECT id, agent_id, task_input, cron_expression, next_run_at, last_run_at, result, error_text, is_active, created_at, updated_at
			 FROM scheduled_tasks ORDER BY created_at DESC`,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("list scheduled tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*model.ScheduledTask
	for rows.Next() {
		t := &model.ScheduledTask{}
		var nra, lra, ca, ua string
		if err := rows.Scan(&t.ID, &t.AgentID, &t.TaskInput, &t.CronExpression, &nra, &lra, &t.Result, &t.ErrorText, &t.IsActive, &ca, &ua); err != nil {
			return nil, err
		}
		t.NextRunAt, _ = time.Parse(time.RFC3339, nra)
		t.LastRunAt, _ = time.Parse(time.RFC3339, lra)
		t.CreatedAt, _ = time.Parse(time.RFC3339, ca)
		t.UpdatedAt, _ = time.Parse(time.RFC3339, ua)
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (s *ScheduledTaskStore) Update(t *model.ScheduledTask) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`UPDATE scheduled_tasks SET cron_expression=?, next_run_at=?, last_run_at=?, result=?, error_text=?, is_active=?, updated_at=? WHERE id=?`,
		t.CronExpression, t.NextRunAt.Format(time.RFC3339), t.LastRunAt.Format(time.RFC3339), t.Result, t.ErrorText, t.IsActive, now, t.ID,
	)
	return err
}

func (s *ScheduledTaskStore) UpdateLastRun(id string, now time.Time) error {
	_, err := s.db.Exec(`UPDATE scheduled_tasks SET last_run_at=?, updated_at=? WHERE id=?`, now.Format(time.RFC3339), now.Format(time.RFC3339), id)
	return err
}

func (s *ScheduledTaskStore) UpdateNextRun(id string, next time.Time) error {
	_, err := s.db.Exec(`UPDATE scheduled_tasks SET next_run_at=?, updated_at=? WHERE id=?`, next.Format(time.RFC3339), next.Format(time.RFC3339), id)
	return err
}

func (s *ScheduledTaskStore) Delete(id string) error {
	_, err := s.db.Exec(`DELETE FROM scheduled_tasks WHERE id=?`, id)
	return err
}

func (s *ScheduledTaskStore) GetDueTasks(now time.Time) ([]*model.ScheduledTask, error) {
	rows, err := s.db.Query(
		`SELECT id, agent_id, task_input, cron_expression, next_run_at, last_run_at, result, error_text, is_active, created_at, updated_at
		 FROM scheduled_tasks WHERE is_active=1 AND next_run_at<=? ORDER BY next_run_at ASC`,
		now.Format(time.RFC3339),
	)
	if err != nil {
		return nil, fmt.Errorf("get due tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*model.ScheduledTask
	for rows.Next() {
		t := &model.ScheduledTask{}
		var nra, lra, ca, ua string
		if err := rows.Scan(&t.ID, &t.AgentID, &t.TaskInput, &t.CronExpression, &nra, &lra, &t.Result, &t.ErrorText, &t.IsActive, &ca, &ua); err != nil {
			return nil, err
		}
		t.NextRunAt, _ = time.Parse(time.RFC3339, nra)
		t.LastRunAt, _ = time.Parse(time.RFC3339, lra)
		t.CreatedAt, _ = time.Parse(time.RFC3339, ca)
		t.UpdatedAt, _ = time.Parse(time.RFC3339, ua)
		tasks = append(tasks, t)
	}
	return tasks, nil
}
