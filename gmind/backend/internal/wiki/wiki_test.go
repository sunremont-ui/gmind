package wiki

import (
	"os"
	"path/filepath"
	"testing"
)

func newTestStore(t *testing.T) *Store {
	t.Helper()
	dir, err := os.MkdirTemp("", "wiki-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	s, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestNewStore(t *testing.T) {
	s := newTestStore(t)
	if s == nil {
		t.Fatal("store is nil")
	}
	if s.Root() == "" {
		t.Fatal("root is empty")
	}
}

func TestWriteAndRead(t *testing.T) {
	s := newTestStore(t)

	_, err := s.Write("test-page", "# Hello World\n\nThis is a test page.")
	if err != nil {
		t.Fatal(err)
	}

	p, err := s.Read("test-page")
	if err != nil {
		t.Fatal(err)
	}
	if p.Slug != "test-page" {
		t.Fatalf("expected slug test-page, got %s", p.Slug)
	}
	if p.Title != "Hello World" {
		t.Fatalf("expected title Hello World, got %s", p.Title)
	}
}

func TestReadNotFound(t *testing.T) {
	s := newTestStore(t)
	_, err := s.Read("nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent page")
	}
}

func TestWriteAndSearch(t *testing.T) {
	s := newTestStore(t)

	s.Write("apple", "# Apple\n\nApples are sweet fruits.")
	s.Write("banana", "# Banana\n\nBananas are yellow.")
	s.Write("cherry", "# Cherry\n\nCherries are small and red.")

	results, err := s.Search("apple", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) < 1 {
		t.Fatal("expected at least 1 result for 'apple'")
	}
	if results[0].Slug != "apple" {
		t.Fatalf("expected apple first, got %s", results[0].Slug)
	}

	results, err = s.Search("yellow", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) < 1 {
		t.Fatal("expected at least 1 result for 'yellow'")
	}
	if results[0].Slug != "banana" {
		t.Fatalf("expected banana, got %s", results[0].Slug)
	}
}

func TestSearchRanking(t *testing.T) {
	s := newTestStore(t)

	s.Write("page-one", "# Go Programming\n\nGo is a statically typed language.")
	s.Write("page-two", "# Going Further\n\nGoing deeper into Go and its ecosystem.")

	results, err := s.Search("Go", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) < 2 {
		t.Fatal("expected 2 results")
	}
}

func TestDelete(t *testing.T) {
	s := newTestStore(t)
	s.Write("temp", "# Temp\n\nTemporary page.")
	if err := s.Delete("temp"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Read("temp"); err == nil {
		t.Fatal("expected error after delete")
	}
}

func TestDeleteNotFound(t *testing.T) {
	s := newTestStore(t)
	if err := s.Delete("nonexistent"); err == nil {
		t.Fatal("expected error for deleting nonexistent page")
	}
}

func TestList(t *testing.T) {
	s := newTestStore(t)
	s.Write("a", "# A\n\nPage A.")
	s.Write("b", "# B\n\nPage B.")
	s.Write("c", "# C\n\nPage C.")

	pages, err := s.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(pages) != 3 {
		t.Fatalf("expected 3 pages, got %d", len(pages))
	}
}

func TestWriteCreatesFile(t *testing.T) {
	s := newTestStore(t)
	s.Write("real-file", "# Real\n\nContent here.")

	path := filepath.Join(s.Root(), "real-file.md")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Fatal("file was not created on disk")
	}
}

func TestExtractTitle(t *testing.T) {
	tests := []struct {
		content string
		want    string
	}{
		{"# Hello\n\nBody", "Hello"},
		{"No heading\nJust text", "No heading"},
		{"", "Untitled"},
		{"  \n\n# Indented\n\nBody", "Indented"},
	}
	for _, tt := range tests {
		got := extractTitle(tt.content)
		if got != tt.want {
			t.Errorf("extractTitle(%q) = %q, want %q", tt.content, got, tt.want)
		}
	}
}
