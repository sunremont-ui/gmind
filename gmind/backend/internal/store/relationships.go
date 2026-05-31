package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// RelationshipRecord — flat row matching V5.0 schema (migration 010).
type RelationshipRecord struct {
	ID               string  `json:"id"`
	WorkbookID       string  `json:"workbook_id"`
	FromWorkbookID   string  `json:"from_workbook_id,omitempty"`
	FromSheetID      string  `json:"from_sheet_id,omitempty"`
	FromTopicID      string  `json:"from_topic_id"`
	ToWorkbookID     string  `json:"to_workbook_id,omitempty"`
	ToSheetID        string  `json:"to_sheet_id,omitempty"`
	ToTopicID        string  `json:"to_topic_id"`
	Type             string  `json:"type"`
	Direction        string  `json:"direction"`
	Title            string  `json:"title,omitempty"`
	Weight           float64 `json:"weight"`
	Notes            string  `json:"notes,omitempty"`
	Color            string  `json:"color,omitempty"`
	Style            string  `json:"style"`
	CreatedBy        string  `json:"created_by"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
	Metadata         string  `json:"metadata"`
}

type RelationshipStore struct {
	db *sql.DB
}

func NewRelationshipStore(db *sql.DB) *RelationshipStore {
	return &RelationshipStore{db: db}
}

const relCols = `id, workbook_id, from_workbook_id, from_sheet_id, from_topic_id,
to_workbook_id, to_sheet_id, to_topic_id, type, direction, title, weight, notes,
color, style, created_by, created_at, updated_at, metadata`

func scanRelationship(scanner interface{ Scan(...any) error }) (*RelationshipRecord, error) {
	r := &RelationshipRecord{}
	err := scanner.Scan(
		&r.ID, &r.WorkbookID, &r.FromWorkbookID, &r.FromSheetID, &r.FromTopicID,
		&r.ToWorkbookID, &r.ToSheetID, &r.ToTopicID, &r.Type, &r.Direction, &r.Title,
		&r.Weight, &r.Notes, &r.Color, &r.Style, &r.CreatedBy, &r.CreatedAt, &r.UpdatedAt,
		&r.Metadata,
	)
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (s *RelationshipStore) Insert(r *RelationshipRecord) error {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if r.CreatedAt == "" {
		r.CreatedAt = now
	}
	r.UpdatedAt = now
	if r.Type == "" {
		r.Type = "relates_to"
	}
	if r.Direction == "" {
		r.Direction = "forward"
	}
	if r.Style == "" {
		r.Style = "solid"
	}
	if r.CreatedBy == "" {
		r.CreatedBy = "user"
	}
	if r.Metadata == "" {
		r.Metadata = "{}"
	}
	if r.Weight == 0 {
		r.Weight = 1.0
	}
	_, err := s.db.Exec(
		`INSERT INTO relationships (`+relCols+`)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.WorkbookID, r.FromWorkbookID, r.FromSheetID, r.FromTopicID,
		r.ToWorkbookID, r.ToSheetID, r.ToTopicID, r.Type, r.Direction, r.Title,
		r.Weight, r.Notes, r.Color, r.Style, r.CreatedBy, r.CreatedAt, r.UpdatedAt, r.Metadata,
	)
	return err
}

func (s *RelationshipStore) Get(id string) (*RelationshipRecord, error) {
	row := s.db.QueryRow(`SELECT `+relCols+` FROM relationships WHERE id = ?`, id)
	r, err := scanRelationship(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return r, err
}

// ListByWorkbook returns all relationships whose workbook_id matches.
func (s *RelationshipStore) ListByWorkbook(workbookID string) ([]*RelationshipRecord, error) {
	rows, err := s.db.Query(`SELECT `+relCols+` FROM relationships WHERE workbook_id = ? ORDER BY created_at`, workbookID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRelList(rows)
}

// ListByTopic returns relationships where the topic appears as either endpoint.
func (s *RelationshipStore) ListByTopic(topicID string) ([]*RelationshipRecord, error) {
	rows, err := s.db.Query(`SELECT `+relCols+` FROM relationships WHERE from_topic_id = ? OR to_topic_id = ? ORDER BY created_at`, topicID, topicID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRelList(rows)
}

// FindBetween returns all relationships between two topics (multi-edge support).
// Includes bidirectional and undirected matches regardless of from/to order.
func (s *RelationshipStore) FindBetween(topicA, topicB string) ([]*RelationshipRecord, error) {
	rows, err := s.db.Query(
		`SELECT `+relCols+` FROM relationships
		 WHERE (from_topic_id = ? AND to_topic_id = ?) OR (from_topic_id = ? AND to_topic_id = ?)`,
		topicA, topicB, topicB, topicA,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanRelList(rows)
}

func scanRelList(rows *sql.Rows) ([]*RelationshipRecord, error) {
	var out []*RelationshipRecord
	for rows.Next() {
		r, err := scanRelationship(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *RelationshipStore) Update(id string, patch map[string]any) error {
	if len(patch) == 0 {
		return nil
	}
	allowed := map[string]bool{
		"title": true, "type": true, "direction": true, "weight": true,
		"notes": true, "color": true, "style": true, "metadata": true,
	}
	setClauses := []string{}
	args := []any{}
	for k, v := range patch {
		if !allowed[k] {
			continue
		}
		setClauses = append(setClauses, k+" = ?")
		args = append(args, v)
	}
	if len(setClauses) == 0 {
		return nil
	}
	setClauses = append(setClauses, "updated_at = ?")
	args = append(args, time.Now().UTC().Format(time.RFC3339))
	args = append(args, id)
	q := fmt.Sprintf(`UPDATE relationships SET %s WHERE id = ?`, strings.Join(setClauses, ", "))
	_, err := s.db.Exec(q, args...)
	return err
}

func (s *RelationshipStore) Delete(id string) error {
	_, err := s.db.Exec(`DELETE FROM relationships WHERE id = ?`, id)
	return err
}

// DeleteByTopic removes all relationships where the topic is an endpoint.
// Used when a topic is deleted to cascade-clean orphan edges.
func (s *RelationshipStore) DeleteByTopic(topicID string) error {
	_, err := s.db.Exec(`DELETE FROM relationships WHERE from_topic_id = ? OR to_topic_id = ?`, topicID, topicID)
	return err
}

// DeleteByWorkbook removes all relationships of a workbook. Used on workbook delete.
func (s *RelationshipStore) DeleteByWorkbook(workbookID string) error {
	_, err := s.db.Exec(`DELETE FROM relationships WHERE workbook_id = ?`, workbookID)
	return err
}

// Traverse performs BFS from a starting topic, optionally filtered by relationship types.
// Returns visited topic IDs and the relationships traversed.
// For undirected/bidirectional edges, neighbors are reached in either direction.
// For forward edges, neighbor is whichever side is not the current node.
func (s *RelationshipStore) Traverse(startTopicID string, depth int, types []string) ([]string, []*RelationshipRecord, error) {
	if depth <= 0 {
		return []string{startTopicID}, nil, nil
	}
	typeSet := make(map[string]bool, len(types))
	for _, t := range types {
		typeSet[t] = true
	}
	visited := map[string]bool{startTopicID: true}
	current := []string{startTopicID}
	var allRels []*RelationshipRecord
	seenRel := map[string]bool{}

	for d := 0; d < depth && len(current) > 0; d++ {
		var next []string
		for _, tid := range current {
			rels, err := s.ListByTopic(tid)
			if err != nil {
				return nil, nil, fmt.Errorf("traverse list: %w", err)
			}
			for _, rel := range rels {
				if len(typeSet) > 0 && !typeSet[rel.Type] {
					continue
				}
				if !seenRel[rel.ID] {
					seenRel[rel.ID] = true
					allRels = append(allRels, rel)
				}
				var neighbor string
				if rel.FromTopicID == tid {
					neighbor = rel.ToTopicID
				} else {
					// rel arrived via to_topic_id; only follow if direction allows
					if rel.Direction == "forward" {
						continue
					}
					neighbor = rel.FromTopicID
				}
				if neighbor == "" || neighbor == tid {
					continue
				}
				if !visited[neighbor] {
					visited[neighbor] = true
					next = append(next, neighbor)
				}
			}
		}
		current = next
	}
	topics := make([]string, 0, len(visited))
	for t := range visited {
		topics = append(topics, t)
	}
	return topics, allRels, nil
}

// DetectCycles finds directional cycles (using forward edges of given typeFilter).
// Returns a list of cycles, each as a slice of topic IDs in cycle order.
// If typeFilter is empty, considers all types with direction='forward'.
func (s *RelationshipStore) DetectCycles(workbookID string, typeFilter string) ([][]string, error) {
	rels, err := s.ListByWorkbook(workbookID)
	if err != nil {
		return nil, err
	}
	adj := map[string][]string{}
	for _, r := range rels {
		if r.Direction != "forward" {
			continue
		}
		if typeFilter != "" && r.Type != typeFilter {
			continue
		}
		adj[r.FromTopicID] = append(adj[r.FromTopicID], r.ToTopicID)
	}

	const (
		white = 0
		gray  = 1
		black = 2
	)
	color := map[string]int{}
	var cycles [][]string

	var dfs func(node string, path []string)
	dfs = func(node string, path []string) {
		color[node] = gray
		path = append(path, node)
		for _, next := range adj[node] {
			if color[next] == gray {
				for i, p := range path {
					if p == next {
						cycle := append([]string{}, path[i:]...)
						cycles = append(cycles, cycle)
						break
					}
				}
			} else if color[next] == white {
				dfs(next, path)
			}
		}
		color[node] = black
	}
	for node := range adj {
		if color[node] == white {
			dfs(node, nil)
		}
	}
	return cycles, nil
}
