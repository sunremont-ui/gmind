package store

import (
	"testing"
)

func TestRelationshipStoreCRUD(t *testing.T) {
	s, err := New(":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer s.Close()

	rs := NewRelationshipStore(s.DB())

	r1 := &RelationshipRecord{
		WorkbookID:  "wb_1",
		FromTopicID: "tp_a",
		ToTopicID:   "tp_b",
		Type:        "depends_on",
		Direction:   "forward",
		Title:       "A depends on B",
		Notes:       "Critical",
	}
	if err := rs.Insert(r1); err != nil {
		t.Fatalf("insert: %v", err)
	}
	if r1.ID == "" {
		t.Fatal("ID should be generated")
	}

	got, err := rs.Get(r1.ID)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got == nil || got.Type != "depends_on" || got.Title != "A depends on B" {
		t.Fatalf("get mismatch: %+v", got)
	}
	if got.Weight != 1.0 {
		t.Errorf("default weight: got %v", got.Weight)
	}

	// Update
	if err := rs.Update(r1.ID, map[string]any{"title": "Updated", "weight": 0.5}); err != nil {
		t.Fatalf("update: %v", err)
	}
	got, _ = rs.Get(r1.ID)
	if got.Title != "Updated" || got.Weight != 0.5 {
		t.Fatalf("update did not apply: %+v", got)
	}

	// List by topic
	list, err := rs.ListByTopic("tp_a")
	if err != nil || len(list) != 1 {
		t.Fatalf("list by topic: %v %d", err, len(list))
	}
	list, err = rs.ListByTopic("tp_b")
	if err != nil || len(list) != 1 {
		t.Fatalf("list by topic (to): %v %d", err, len(list))
	}

	// Multi-edge: second relationship same pair, different type
	r2 := &RelationshipRecord{
		WorkbookID:  "wb_1",
		FromTopicID: "tp_a",
		ToTopicID:   "tp_b",
		Type:        "references",
		Direction:   "forward",
	}
	if err := rs.Insert(r2); err != nil {
		t.Fatalf("insert multi-edge: %v", err)
	}
	between, _ := rs.FindBetween("tp_a", "tp_b")
	if len(between) != 2 {
		t.Fatalf("multi-edge: expected 2, got %d", len(between))
	}

	// Delete
	if err := rs.Delete(r2.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	between, _ = rs.FindBetween("tp_a", "tp_b")
	if len(between) != 1 {
		t.Fatalf("after delete: expected 1, got %d", len(between))
	}
}

func TestRelationshipTraverse(t *testing.T) {
	s, err := New(":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer s.Close()

	rs := NewRelationshipStore(s.DB())
	// Build: A → B → C, A → D
	insert := func(from, to string) {
		t.Helper()
		err := rs.Insert(&RelationshipRecord{
			WorkbookID:  "wb_1",
			FromTopicID: from,
			ToTopicID:   to,
			Type:        "relates_to",
			Direction:   "forward",
		})
		if err != nil {
			t.Fatalf("insert: %v", err)
		}
	}
	insert("A", "B")
	insert("B", "C")
	insert("A", "D")

	topics, _, err := rs.Traverse("A", 1, nil)
	if err != nil {
		t.Fatalf("traverse depth 1: %v", err)
	}
	// A, B, D at depth 1
	if len(topics) != 3 {
		t.Fatalf("depth 1: expected 3 topics, got %d (%v)", len(topics), topics)
	}

	topics, _, err = rs.Traverse("A", 2, nil)
	if err != nil {
		t.Fatalf("traverse depth 2: %v", err)
	}
	// A, B, C, D at depth 2
	if len(topics) != 4 {
		t.Fatalf("depth 2: expected 4 topics, got %d (%v)", len(topics), topics)
	}
}

func TestDetectCycles(t *testing.T) {
	s, err := New(":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer s.Close()

	rs := NewRelationshipStore(s.DB())
	insert := func(from, to string) {
		err := rs.Insert(&RelationshipRecord{
			WorkbookID:  "wb_1",
			FromTopicID: from,
			ToTopicID:   to,
			Type:        "depends_on",
			Direction:   "forward",
		})
		if err != nil {
			t.Fatalf("insert: %v", err)
		}
	}
	// A → B → C → A (cycle)
	insert("A", "B")
	insert("B", "C")
	insert("C", "A")
	// D → E (no cycle)
	insert("D", "E")

	cycles, err := rs.DetectCycles("wb_1", "depends_on")
	if err != nil {
		t.Fatalf("detect cycles: %v", err)
	}
	if len(cycles) != 1 {
		t.Fatalf("expected 1 cycle, got %d: %v", len(cycles), cycles)
	}
	if len(cycles[0]) != 3 {
		t.Fatalf("cycle length: expected 3, got %d: %v", len(cycles[0]), cycles[0])
	}
}

func TestSelfLoop(t *testing.T) {
	s, err := New(":memory:")
	if err != nil {
		t.Fatalf("open store: %v", err)
	}
	defer s.Close()

	rs := NewRelationshipStore(s.DB())
	r := &RelationshipRecord{
		WorkbookID:  "wb_1",
		FromTopicID: "A",
		ToTopicID:   "A",
		Type:        "relates_to",
		Direction:   "forward",
	}
	if err := rs.Insert(r); err != nil {
		t.Fatalf("self-loop insert: %v", err)
	}
	list, _ := rs.ListByTopic("A")
	if len(list) != 1 {
		t.Fatalf("self-loop list: expected 1, got %d", len(list))
	}
}
