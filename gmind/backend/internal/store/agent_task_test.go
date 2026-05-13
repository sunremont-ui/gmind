package store

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func newTestTaskStore(t *testing.T) *TaskStore {
	t.Helper()
	s := newTestStore(t)
	return NewTaskStore(s.DB())
}

func TestTaskStoreInsertAndGet(t *testing.T) {
	ts := newTestTaskStore(t)

	rec := &AgentTaskRecord{
		ID:         uuid.New().String(),
		AgentID:    "agent-1",
		Action:     "test_action",
		Params:     json.RawMessage(`{"key":"value"}`),
		WorkbookID: "wb-1",
		SheetID:    "sheet-1",
		TopicID:    "topic-1",
		Status:     "queued",
		MaxCalls:   3,
		CreatedAt:  time.Now().UTC().Format(time.RFC3339),
		UpdatedAt:  time.Now().UTC().Format(time.RFC3339),
	}

	if err := ts.Insert(rec); err != nil {
		t.Fatalf("Insert: %v", err)
	}

	got, err := ts.Get(rec.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Action != "test_action" {
		t.Errorf("Action = %q, want %q", got.Action, "test_action")
	}
	if got.Status != "queued" {
		t.Errorf("Status = %q, want %q", got.Status, "queued")
	}
	if got.MaxCalls != 3 {
		t.Errorf("MaxCalls = %d, want 3", got.MaxCalls)
	}
}

func TestTaskStoreGetNotFound(t *testing.T) {
	ts := newTestTaskStore(t)
	_, err := ts.Get("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent task")
	}
}

func TestTaskStoreInsertDuplicate(t *testing.T) {
	ts := newTestTaskStore(t)

	rec := &AgentTaskRecord{
		ID:        "dup-id",
		AgentID:   "agent-1",
		Action:    "test",
		Status:    "queued",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}

	if err := ts.Insert(rec); err != nil {
		t.Fatalf("first insert: %v", err)
	}
	if err := ts.Insert(rec); err == nil {
		t.Fatal("expected error on duplicate insert")
	}
}

func TestTaskStoreUpdateStatus(t *testing.T) {
	ts := newTestTaskStore(t)

	rec := &AgentTaskRecord{
		ID:        uuid.New().String(),
		AgentID:   "agent-1",
		Action:    "test",
		Status:    "queued",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	ts.Insert(rec)

	result := json.RawMessage(`{"done":true}`)
	if err := ts.UpdateStatus(rec.ID, "done", "", result); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}

	got, _ := ts.Get(rec.ID)
	if got.Status != "done" {
		t.Errorf("Status = %q, want %q", got.Status, "done")
	}
	if string(got.Result) != `{"done":true}` {
		t.Errorf("Result = %s, want %q", got.Result, `{"done":true}`)
	}
}

func TestTaskStoreUpdateStatusWithError(t *testing.T) {
	ts := newTestTaskStore(t)

	rec := &AgentTaskRecord{
		ID:        uuid.New().String(),
		AgentID:   "agent-1",
		Action:    "test",
		Status:    "running",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	ts.Insert(rec)

	if err := ts.UpdateStatus(rec.ID, "failed", "something went wrong", nil); err != nil {
		t.Fatalf("UpdateStatus: %v", err)
	}

	got, _ := ts.Get(rec.ID)
	if got.Status != "failed" {
		t.Errorf("Status = %q, want %q", got.Status, "failed")
	}
	if got.Error != "something went wrong" {
		t.Errorf("Error = %q, want %q", got.Error, "something went wrong")
	}
}

func TestTaskStoreList(t *testing.T) {
	ts := newTestTaskStore(t)

	for i := 0; i < 3; i++ {
		ts.Insert(&AgentTaskRecord{
			ID:        uuid.New().String(),
			AgentID:   "agent-1",
			Action:    "action",
			Status:    "queued",
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}
	for i := 0; i < 2; i++ {
		ts.Insert(&AgentTaskRecord{
			ID:        uuid.New().String(),
			AgentID:   "agent-2",
			Action:    "other",
			Status:    "queued",
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}

	all, err := ts.List("")
	if err != nil {
		t.Fatalf("List(''): %v", err)
	}
	if len(all) != 5 {
		t.Errorf("List() = %d, want 5", len(all))
	}

	byAgent, err := ts.List("agent-1")
	if err != nil {
		t.Fatalf("List(agent-1): %v", err)
	}
	if len(byAgent) != 3 {
		t.Errorf("List(agent-1) = %d, want 3", len(byAgent))
	}
}

func TestTaskStoreListOrder(t *testing.T) {
	ts := newTestTaskStore(t)

	// Insert with explicit order
	rec1 := &AgentTaskRecord{
		ID:        uuid.New().String(),
		AgentID:   "agent-1",
		Action:    "first",
		Status:    "queued",
		CreatedAt: "2024-01-01T00:00:00Z",
		UpdatedAt: "2024-01-01T00:00:00Z",
	}
	rec2 := &AgentTaskRecord{
		ID:        uuid.New().String(),
		AgentID:   "agent-1",
		Action:    "second",
		Status:    "queued",
		CreatedAt: "2024-01-02T00:00:00Z",
		UpdatedAt: "2024-01-02T00:00:00Z",
	}
	ts.Insert(rec1)
	ts.Insert(rec2)

	list, _ := ts.List("agent-1")
	if len(list) != 2 {
		t.Fatalf("List = %d, want 2", len(list))
	}
	// Most recent first (ORDER BY created_at DESC)
	if list[0].Action != "second" {
		t.Errorf("first item action = %q, want 'second'", list[0].Action)
	}
}

func TestTaskStoreLoadQueued(t *testing.T) {
	ts := newTestTaskStore(t)

	ids := make([]string, 3)
	for i := 0; i < 3; i++ {
		id := uuid.New().String()
		status := "queued"
		if i == 1 {
			status = "running"
		}
		ts.Insert(&AgentTaskRecord{
			ID:        id,
			AgentID:   "agent-1",
			Action:    "action",
			Status:    status,
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
			UpdatedAt: time.Now().UTC().Format(time.RFC3339),
		})
		ids[i] = id
	}
	// Insert a done task (should not be loaded)
	ts.Insert(&AgentTaskRecord{
		ID:        uuid.New().String(),
		AgentID:   "agent-1",
		Action:    "done",
		Status:    "done",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	})

	queued, err := ts.LoadQueued()
	if err != nil {
		t.Fatalf("LoadQueued: %v", err)
	}
	if len(queued) != 3 {
		t.Errorf("LoadQueued = %d, want 3", len(queued))
	}
	// Running tasks should be reset to queued
	for _, task := range queued {
		if task.Status != "queued" {
			t.Errorf("task %s status = %q, want 'queued'", task.ID, task.Status)
		}
	}
}

func TestTaskStoreLoadQueuedEmpty(t *testing.T) {
	ts := newTestTaskStore(t)
	tasks, err := ts.LoadQueued()
	if err != nil {
		t.Fatalf("LoadQueued empty: %v", err)
	}
	if len(tasks) != 0 {
		t.Errorf("LoadQueued = %d, want 0", len(tasks))
	}
}

func TestTaskStoreGetByIDempotencyKey(t *testing.T) {
	ts := newTestTaskStore(t)

	key := "idem-key-1"
	rec := &AgentTaskRecord{
		ID:             uuid.New().String(),
		AgentID:        "agent-1",
		Action:         "test",
		Status:         "queued",
		IdempotencyKey: key,
		CreatedAt:      time.Now().UTC().Format(time.RFC3339),
		UpdatedAt:      time.Now().UTC().Format(time.RFC3339),
	}
	ts.Insert(rec)

	got, err := ts.GetByIDempotencyKey(key)
	if err != nil {
		t.Fatalf("GetByIDempotencyKey: %v", err)
	}
	if got == nil {
		t.Fatal("expected task, got nil")
	}
	if got.ID != rec.ID {
		t.Errorf("ID = %s, want %s", got.ID, rec.ID)
	}
}

func TestTaskStoreGetByIDempotencyKeyNotFound(t *testing.T) {
	ts := newTestTaskStore(t)
	got, err := ts.GetByIDempotencyKey("nonexistent")
	if err != nil {
		t.Fatalf("GetByIDempotencyKey: %v", err)
	}
	if got != nil {
		t.Fatal("expected nil for missing key")
	}
}

func TestTaskStoreGetByIDempotencyKeyEmptyKey(t *testing.T) {
	ts := newTestTaskStore(t)
	got, err := ts.GetByIDempotencyKey("")
	if err != nil {
		t.Fatalf("GetByIDempotencyKey empty: %v", err)
	}
	if got != nil {
		t.Fatal("expected nil for empty key")
	}
}

func TestTaskStoreResetRunning(t *testing.T) {
	ts := newTestTaskStore(t)

	rec := &AgentTaskRecord{
		ID:        uuid.New().String(),
		AgentID:   "agent-1",
		Action:    "test",
		Status:    "running",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	ts.Insert(rec)

	if err := ts.ResetRunning(); err != nil {
		t.Fatalf("ResetRunning: %v", err)
	}

	got, _ := ts.Get(rec.ID)
	if got.Status != "queued" {
		t.Errorf("Status = %q, want 'queued'", got.Status)
	}
}

func TestTaskStoreResetRunningOnlyRunning(t *testing.T) {
	ts := newTestTaskStore(t)

	done := &AgentTaskRecord{
		ID:        uuid.New().String(),
		AgentID:   "agent-1",
		Action:    "done",
		Status:    "done",
		CreatedAt: time.Now().UTC().Format(time.RFC3339),
		UpdatedAt: time.Now().UTC().Format(time.RFC3339),
	}
	ts.Insert(done)

	ts.ResetRunning()

	got, _ := ts.Get(done.ID)
	if got.Status != "done" {
		t.Errorf("done task status changed to %q, want 'done'", got.Status)
	}
}
