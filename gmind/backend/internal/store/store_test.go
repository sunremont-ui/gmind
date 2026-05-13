package store

import (
	"os"
	"testing"
	"time"

	"github.com/gmind/backend/internal/model"
	"github.com/google/uuid"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	f, err := os.CreateTemp("", "gmind-test-*.db")
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
	t.Cleanup(func() { os.Remove(f.Name()) })

	s, err := New(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}

func TestCreateAndGetWorkbook(t *testing.T) {
	s := newTestStore(t)

	wb := &model.Workbook{
		ID:        uuid.New().String(),
		Title:     "Test Workbook",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		Sheets: []*model.Sheet{
			{
				ID:    uuid.New().String(),
				Title: "Sheet 1",
				RootTopic: &model.Topic{
					ID:    uuid.New().String(),
					Title: "Root",
				},
			},
		},
	}

	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatalf("CreateWorkbook: %v", err)
	}

	got, err := s.GetWorkbook(wb.ID)
	if err != nil {
		t.Fatalf("GetWorkbook: %v", err)
	}
	if got == nil {
		t.Fatal("GetWorkbook returned nil")
	}
	if got.Title != wb.Title {
		t.Errorf("Title = %q, want %q", got.Title, wb.Title)
	}
	if len(got.Sheets) != 1 {
		t.Errorf("len(Sheets) = %d, want 1", len(got.Sheets))
	}
}

func TestGetWorkbookNotFound(t *testing.T) {
	s := newTestStore(t)
	got, err := s.GetWorkbook("nonexistent")
	if err != nil {
		t.Fatalf("GetWorkbook: %v", err)
	}
	if got != nil {
		t.Fatal("expected nil for missing workbook")
	}
}

func TestListWorkbooks(t *testing.T) {
	s := newTestStore(t)

	for i := 0; i < 3; i++ {
		wb := &model.Workbook{
			ID:    uuid.New().String(),
			Title: "WB",
		}
		if err := s.CreateWorkbook(wb); err != nil {
			t.Fatal(err)
		}
	}

	list, err := s.ListWorkbooks()
	if err != nil {
		t.Fatalf("ListWorkbooks: %v", err)
	}
	if len(list) != 3 {
		t.Errorf("got %d workbooks, want 3", len(list))
	}
}

func TestUpdateWorkbook(t *testing.T) {
	s := newTestStore(t)

	wb := &model.Workbook{
		ID:    uuid.New().String(),
		Title: "Original",
	}
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	wb.Title = "Updated"
	if err := s.UpdateWorkbook(wb); err != nil {
		t.Fatalf("UpdateWorkbook: %v", err)
	}

	got, _ := s.GetWorkbook(wb.ID)
	if got.Title != "Updated" {
		t.Errorf("Title = %q, want %q", got.Title, "Updated")
	}
}

func TestDeleteWorkbook(t *testing.T) {
	s := newTestStore(t)

	wb := &model.Workbook{
		ID:    uuid.New().String(),
		Title: "To Delete",
	}
	s.CreateWorkbook(wb)

	if err := s.DeleteWorkbook(wb.ID); err != nil {
		t.Fatalf("DeleteWorkbook: %v", err)
	}

	got, _ := s.GetWorkbook(wb.ID)
	if got != nil {
		t.Fatal("expected nil after delete")
	}
}

func TestCollaborators(t *testing.T) {
	s := newTestStore(t)
	wbID := uuid.New().String()

	if err := s.AddCollaborator(wbID, "user1", "editor"); err != nil {
		t.Fatal(err)
	}
	if err := s.AddCollaborator(wbID, "user2", "viewer"); err != nil {
		t.Fatal(err)
	}

	users, err := s.GetCollaborators(wbID)
	if err != nil {
		t.Fatal(err)
	}
	if len(users) != 2 {
		t.Errorf("got %d collaborators, want 2", len(users))
	}

	if err := s.RemoveCollaborator(wbID, "user1"); err != nil {
		t.Fatal(err)
	}
	users, _ = s.GetCollaborators(wbID)
	if len(users) != 1 {
		t.Errorf("got %d after removal, want 1", len(users))
	}
}

func TestMigrationsCreateSchema(t *testing.T) {
	s := newTestStore(t)

	// Verify tables exist
	tables := []string{"workbooks", "workbook_collaborators", "agent_tasks", "schema_migrations"}
	for _, name := range tables {
		var count int
		err := s.db.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?`, name).Scan(&count)
		if err != nil {
			t.Fatal(err)
		}
		if count == 0 {
			t.Errorf("table %q not found", name)
		}
	}
}

func TestMigrationsIdempotent(t *testing.T) {
	s := newTestStore(t)

	// Running migrate twice should not error
	if err := s.migrate(); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
}

func TestSequentialBulkCreate(t *testing.T) {
	s := newTestStore(t)
	n := 10

	for i := 0; i < n; i++ {
		wb := &model.Workbook{
			ID:    uuid.New().String(),
			Title: "Bulk",
		}
		if err := s.CreateWorkbook(wb); err != nil {
			t.Fatalf("create %d: %v", i, err)
		}
	}

	list, _ := s.ListWorkbooks()
	if len(list) != n {
		t.Errorf("got %d workbooks, want %d", len(list), n)
	}
}
