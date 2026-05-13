package agent

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/store"
	"github.com/google/uuid"
)

func newTestStore(t *testing.T) *store.Store {
	t.Helper()
	s, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func newTestLogger() core.Logger {
	return core.NewStdLogger()
}

func TestToolRegistry(t *testing.T) {
	if len(ToolRegistry) == 0 {
		t.Fatal("ToolRegistry is empty")
	}
	names := map[string]bool{}
	for _, td := range ToolRegistry {
		if td.Name == "" {
			t.Error("tool with empty name")
		}
		if td.Schema == nil {
			t.Errorf("tool %q has nil schema", td.Name)
		}
		if names[td.Name] {
			t.Errorf("duplicate tool name: %q", td.Name)
		}
		names[td.Name] = true
	}
}

func TestGetToolsForRole(t *testing.T) {
	tests := []struct {
		role     string
		minTools int
	}{
		{"researcher", 2},
		{"organizer", 1},
		{"expander", 1},
		{"critic", 2},
		{"analyst", 2},
		{"editor", 1},
		{"unknown", 8},
	}
	for _, tc := range tests {
		tools := GetToolsForRole(tc.role)
		if len(tools) < tc.minTools {
			t.Errorf("role %q: got %d tools, want at least %d", tc.role, len(tools), tc.minTools)
		}
	}
}

func TestTaskQueueEnqueueDequeue(t *testing.T) {
	logger := newTestLogger()
	q := NewTaskQueue(nil, logger)

	task := &Task{
		AgentID:    "agent-1",
		Action:     "test_action",
		Params:     map[string]any{"key": "value"},
		WorkbookID: "wb-1",
		MaxCalls:   5,
	}

	if err := q.Enqueue(task); err != nil {
		t.Fatalf("Enqueue: %v", err)
	}
	if task.ID == "" {
		t.Fatal("expected task ID to be set")
	}
	if task.Status != TaskQueued {
		t.Errorf("status = %s, want %s", task.Status, TaskQueued)
	}

	got := q.Dequeue("agent-1")
	if got == nil {
		t.Fatal("expected task, got nil")
	}
	if got.ID != task.ID {
		t.Errorf("id = %s, want %s", got.ID, task.ID)
	}
	if got.Status != TaskRunning {
		t.Errorf("status = %s, want %s", got.Status, TaskRunning)
	}

	// Also verify it's tracked in done
	got2, err := q.Get(task.ID)
	if err != nil {
		t.Fatalf("Get after dequeue: %v", err)
	}
	if got2.Status != TaskRunning {
		t.Errorf("Get status = %s, want %s", got2.Status, TaskRunning)
	}
}

func TestTaskQueueNoTask(t *testing.T) {
	logger := newTestLogger()
	q := NewTaskQueue(nil, logger)
	got := q.Dequeue("nonexistent")
	if got != nil {
		t.Fatal("expected nil for nonexistent agent")
	}
}

func TestTaskQueueCompleteFail(t *testing.T) {
	logger := newTestLogger()
	q := NewTaskQueue(nil, logger)

	task := &Task{AgentID: "agent-1", Action: "test"}
	q.Enqueue(task)
	_ = q.Dequeue("agent-1")

	result := json.RawMessage(`{"done": true}`)
	q.Complete(task.ID, result)

	// Verify via List
	tasks := q.List("agent-1")
	var found bool
	for _, tsk := range tasks {
		if tsk.ID == task.ID {
			found = true
			if tsk.Status != TaskDone {
				t.Errorf("status = %s, want %s", tsk.Status, TaskDone)
			}
			break
		}
	}
	if !found {
		t.Error("task not found in list after Complete")
	}

	// Verify via Get
	got, err := q.Get(task.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Status != TaskDone {
		t.Errorf("Get status = %s, want %s", got.Status, TaskDone)
	}

	// Test Fail
	task2 := &Task{AgentID: "agent-1", Action: "fail_me"}
	q.Enqueue(task2)
	_ = q.Dequeue("agent-1")
	q.Fail(task2.ID, os.ErrInvalid)

	got2, err := q.Get(task2.ID)
	if err != nil {
		t.Fatalf("Get failed task: %v", err)
	}
	if got2.Status != TaskFailed {
		t.Errorf("status = %s, want %s", got2.Status, TaskFailed)
	}
	if got2.Error != os.ErrInvalid.Error() {
		t.Errorf("error = %q, want %q", got2.Error, os.ErrInvalid.Error())
	}
}

func TestTaskQueueApproveReject(t *testing.T) {
	logger := newTestLogger()
	q := NewTaskQueue(nil, logger)

	task := &Task{AgentID: "agent-1", Action: "test"}
	q.Enqueue(task, TaskPendingApproval)

	if task.Status != TaskPendingApproval {
		t.Errorf("status = %s, want %s", task.Status, TaskPendingApproval)
	}

	if err := q.ApproveTask(task.ID); err != nil {
		t.Fatalf("ApproveTask: %v", err)
	}

	got := q.Dequeue("agent-1")
	if got == nil || got.ID != task.ID {
		t.Fatal("expected approved task to be dequeued")
	}

	// Test reject
	task2 := &Task{AgentID: "agent-1", Action: "reject_me"}
	q.Enqueue(task2, TaskPendingApproval)
	if err := q.RejectTask(task2.ID); err != nil {
		t.Fatalf("RejectTask: %v", err)
	}
	if task2.Status != TaskFailed {
		t.Errorf("status = %s, want %s", task2.Status, TaskFailed)
	}
}

func TestTaskQueueIdempotency(t *testing.T) {
	// Idempotency requires SQLite backend - use temp file
	f, err := os.CreateTemp("", "gmind-idem-*.db")
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
	defer os.Remove(f.Name())

	s, err := store.New(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	taskStore := store.NewTaskStore(s.DB())
	logger := newTestLogger()
	q := NewTaskQueue(taskStore, logger)

	key := "idem-key-1"
	task := &Task{AgentID: "agent-1", Action: "test", IdempotencyKey: key}
	if err := q.Enqueue(task); err != nil {
		t.Fatalf("first enqueue: %v", err)
	}
	firstID := task.ID

	task2 := &Task{AgentID: "agent-1", Action: "test", IdempotencyKey: key}
	if err := q.Enqueue(task2); err != nil {
		t.Fatalf("second enqueue: %v", err)
	}
	if task2.ID != firstID {
		t.Errorf("id = %s, want %s (same as first)", task2.ID, firstID)
	}
}

func TestTaskQueueList(t *testing.T) {
	logger := newTestLogger()
	q := NewTaskQueue(nil, logger)

	for i := 0; i < 5; i++ {
		q.Enqueue(&Task{
			AgentID: "agent-1",
			Action:  "action",
		})
	}

	all := q.List("")
	if len(all) != 5 {
		t.Errorf("List() = %d, want 5", len(all))
	}

	byAgent := q.List("agent-1")
	if len(byAgent) != 5 {
		t.Errorf("List(agent-1) = %d, want 5", len(byAgent))
	}

	other := q.List("other")
	if len(other) != 0 {
		t.Errorf("List(other) = %d, want 0", len(other))
	}
}

func TestToolExecutor(t *testing.T) {
	s := newTestStore(t)
	logger := newTestLogger()
	eventBus := core.NewEventBus()

	exec := NewToolExecutor(s, eventBus, logger, nil)
	if exec == nil {
		t.Fatal("NewToolExecutor returned nil")
	}

	callbacks := exec.getCallbacks()
	expectedTools := []string{
		"create_topic", "update_topic", "create_multiple_topics",
		"add_note", "get_topic", "get_workbook",
		"summarize_topics", "search_web",
	}
	for _, name := range expectedTools {
		if _, ok := callbacks[name]; !ok {
			t.Errorf("missing tool callback: %s", name)
		}
	}
}

func TestPromptStoreDefaults(t *testing.T) {
	ps := NewPromptStore("")
	if ps.System() == "" {
		t.Error("expected non-empty system prompt")
	}
	if ps.Role("") == "" {
		t.Error("expected non-empty role prompt for empty role")
	}
	roles := []string{"researcher", "organizer", "critic", "expander", "summarizer", "editor", "analyst"}
	for _, r := range roles {
		if ps.Role(r) == "" {
			t.Errorf("empty prompt for role %q", r)
		}
	}
}

func TestInjectContext(t *testing.T) {
	raw := json.RawMessage(`{"title":"test"}`)
	result, err := injectContext(raw, "wb-1", "sheet-1")
	if err != nil {
		t.Fatalf("injectContext: %v", err)
	}
	var args map[string]any
	json.Unmarshal(result, &args)
	if args["workbook_id"] != "wb-1" {
		t.Errorf("workbook_id = %v, want wb-1", args["workbook_id"])
	}
	if args["sheet_id"] != "sheet-1" {
		t.Errorf("sheet_id = %v, want sheet-1", args["sheet_id"])
	}
	if args["title"] != "test" {
		t.Errorf("title = %v, want test", args["title"])
	}
}

func TestInjectContextExisting(t *testing.T) {
	raw := json.RawMessage(`{"workbook_id":"existing","title":"test"}`)
	result, err := injectContext(raw, "wb-1", "sheet-1")
	if err != nil {
		t.Fatalf("injectContext: %v", err)
	}
	var args map[string]any
	json.Unmarshal(result, &args)
	if args["workbook_id"] != "existing" {
		t.Errorf("workbook_id = %v, want existing (not overwritten)", args["workbook_id"])
	}
	if args["sheet_id"] != "sheet-1" {
		t.Errorf("sheet_id = %v, want sheet-1", args["sheet_id"])
	}
}

func TestFilterTools(t *testing.T) {
	mindmapTools := filterTools("mindmap")
	for _, td := range mindmapTools {
		if td.Category != "mindmap" {
			t.Errorf("tool %q has category %q, want mindmap", td.Name, td.Category)
		}
	}
	if len(mindmapTools) == 0 {
		t.Error("expected at least one mindmap tool")
	}

	searchTools := filterTools("search")
	for _, td := range searchTools {
		if td.Category != "search" {
			t.Errorf("tool %q has category %q, want search", td.Name, td.Category)
		}
	}
}

func TestAgentInfoDefaults(t *testing.T) {
	info := &AgentInfo{
		ID:   uuid.New().String(),
		Role: "researcher",
	}
	if info.Status != "" {
		t.Errorf("expected empty status, got %s", info.Status)
	}
	if info.Provider != "" {
		t.Errorf("expected empty provider, got %s", info.Provider)
	}
}
