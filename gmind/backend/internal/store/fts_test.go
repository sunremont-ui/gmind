package store

import (
	"strings"
	"testing"
	"time"

	"github.com/gmind/backend/internal/model"
	"github.com/google/uuid"
)

func ftsWorkbook(title string, root *model.Topic) *model.Workbook {
	return &model.Workbook{
		ID:        uuid.New().String(),
		Title:     title,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		Sheets: []*model.Sheet{
			{ID: uuid.New().String(), Title: "Sheet 1", RootTopic: root},
		},
	}
}

func TestFTSSearchOnCreate(t *testing.T) {
	s := newTestStore(t)

	wb := ftsWorkbook("Architecture", &model.Topic{
		ID:    "root-1",
		Title: "MASys Platform",
		Children: []*model.Topic{
			{ID: "c1", Title: "Pipeline Executor", Notes: "DAG topological levels"},
			{ID: "c2", Title: "Module Registry"},
		},
	})
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	res, err := s.SearchFTS("pipeline", 10, "")
	if err != nil {
		t.Fatalf("SearchFTS: %v", err)
	}
	if len(res) != 1 {
		t.Fatalf("got %d results, want 1", len(res))
	}
	if res[0].TopicID != "c1" {
		t.Errorf("TopicID = %q, want c1", res[0].TopicID)
	}
	if res[0].WorkbookTitle != "Architecture" {
		t.Errorf("WorkbookTitle = %q, want Architecture", res[0].WorkbookTitle)
	}
	if !strings.Contains(res[0].Context, "<mark>") {
		t.Errorf("expected highlighted snippet, got %q", res[0].Context)
	}

	// Match against notes too.
	res, _ = s.SearchFTS("topological", 10, "")
	if len(res) != 1 || res[0].TopicID != "c1" {
		t.Errorf("notes search failed: %+v", res)
	}
}

func TestFTSPrefixMatch(t *testing.T) {
	s := newTestStore(t)
	wb := ftsWorkbook("WB", &model.Topic{ID: "r", Title: "Observability Dashboard"})
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}
	// Prefix "observ" should match "Observability".
	res, err := s.SearchFTS("observ", 10, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(res) != 1 {
		t.Fatalf("prefix match got %d, want 1", len(res))
	}
}

func TestFTSUpdateAndDelete(t *testing.T) {
	s := newTestStore(t)
	wb := ftsWorkbook("WB", &model.Topic{ID: "r", Title: "Alpha"})
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	// Rename topic -> old term gone, new term found.
	wb.Sheets[0].RootTopic.Title = "Beta"
	if err := s.UpdateWorkbook(wb); err != nil {
		t.Fatal(err)
	}
	if res, _ := s.SearchFTS("alpha", 10, ""); len(res) != 0 {
		t.Errorf("stale term still indexed: %+v", res)
	}
	if res, _ := s.SearchFTS("beta", 10, ""); len(res) != 1 {
		t.Errorf("updated term not indexed")
	}

	// Delete clears the index.
	if err := s.DeleteWorkbook(wb.ID); err != nil {
		t.Fatal(err)
	}
	if res, _ := s.SearchFTS("beta", 10, ""); len(res) != 0 {
		t.Errorf("index not cleared on delete: %+v", res)
	}
}

func TestFTSWorkbookFilterAndReindex(t *testing.T) {
	s := newTestStore(t)
	wb1 := ftsWorkbook("WB1", &model.Topic{ID: "a", Title: "Shared Term"})
	wb2 := ftsWorkbook("WB2", &model.Topic{ID: "b", Title: "Shared Term"})
	if err := s.CreateWorkbook(wb1); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateWorkbook(wb2); err != nil {
		t.Fatal(err)
	}

	if res, _ := s.SearchFTS("shared", 10, ""); len(res) != 2 {
		t.Errorf("global search got %d, want 2", len(res))
	}
	if res, _ := s.SearchFTS("shared", 10, wb1.ID); len(res) != 1 || res[0].WorkbookID != wb1.ID {
		t.Errorf("workbook filter failed: %+v", res)
	}

	// Reindex rebuilds the same state.
	if err := s.ReindexAllFTS(); err != nil {
		t.Fatal(err)
	}
	n, _ := s.CountFTS()
	if n != 2 {
		t.Errorf("after reindex count = %d, want 2", n)
	}
}

func TestFTSEmptyAndSpecialQuery(t *testing.T) {
	s := newTestStore(t)
	wb := ftsWorkbook("WB", &model.Topic{ID: "r", Title: "Quote \"test\" AND OR"})
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}
	// Empty query returns no results, no error.
	if res, err := s.SearchFTS("   ", 10, ""); err != nil || len(res) != 0 {
		t.Errorf("empty query: res=%v err=%v", res, err)
	}
	// FTS operators in user input must not blow up.
	if _, err := s.SearchFTS(`AND OR "quote`, 10, ""); err != nil {
		t.Errorf("special chars query errored: %v", err)
	}
}
