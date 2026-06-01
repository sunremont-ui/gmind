package store

import (
	"fmt"
	"strings"

	"github.com/gmind/backend/internal/model"
)

// FTSResult is a single full-text search hit over a topic.
type FTSResult struct {
	TopicID       string  `json:"topic_id"`
	WorkbookID    string  `json:"workbook_id"`
	WorkbookTitle string  `json:"workbook_title"`
	SheetID       string  `json:"sheet_id"`
	Title         string  `json:"title"`
	Notes         string  `json:"notes,omitempty"`
	Context       string  `json:"context"` // snippet with <mark> highlights
	Rank          float64 `json:"rank"`    // bm25 score (lower = better)
}

// syncWorkbookFTS rebuilds the FTS rows for a single workbook. It deletes the
// existing rows for the workbook and re-inserts one row per topic. Called from
// the workbook CRUD path so the index is always consistent.
func (s *Store) syncWorkbookFTS(wb *model.Workbook) error {
	if wb == nil {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM topics_fts WHERE workbook_id = ?`, wb.ID); err != nil {
		return fmt.Errorf("fts delete: %w", err)
	}

	stmt, err := tx.Prepare(
		`INSERT INTO topics_fts (title, notes, workbook_title, topic_id, workbook_id, sheet_id)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	var insertTree func(sheetID string, t *model.Topic) error
	insertTree = func(sheetID string, t *model.Topic) error {
		if t == nil {
			return nil
		}
		if strings.TrimSpace(t.Title) != "" || strings.TrimSpace(t.Notes) != "" {
			if _, err := stmt.Exec(t.Title, t.Notes, wb.Title, t.ID, wb.ID, sheetID); err != nil {
				return err
			}
		}
		for _, child := range t.Children {
			if err := insertTree(sheetID, child); err != nil {
				return err
			}
		}
		return nil
	}

	for _, sheet := range wb.Sheets {
		if sheet == nil {
			continue
		}
		if err := insertTree(sheet.ID, sheet.RootTopic); err != nil {
			return fmt.Errorf("fts insert: %w", err)
		}
		for _, ft := range sheet.FloatingTopics {
			if err := insertTree(sheet.ID, ft); err != nil {
				return fmt.Errorf("fts insert floating: %w", err)
			}
		}
	}

	return tx.Commit()
}

// deleteWorkbookFTS removes all FTS rows belonging to a workbook.
func (s *Store) deleteWorkbookFTS(workbookID string) error {
	_, err := s.db.Exec(`DELETE FROM topics_fts WHERE workbook_id = ?`, workbookID)
	return err
}

// ReindexAllFTS rebuilds the full-text index from scratch for every workbook.
// Safe to run on startup; cheap for the typical small dataset.
func (s *Store) ReindexAllFTS() error {
	if _, err := s.db.Exec(`DELETE FROM topics_fts`); err != nil {
		return err
	}
	workbooks, err := s.ListWorkbooks()
	if err != nil {
		return err
	}
	for _, wb := range workbooks {
		if err := s.syncWorkbookFTS(wb); err != nil {
			return err
		}
	}
	return nil
}

// SearchFTS runs a full-text query over indexed topics. The raw user query is
// turned into a prefix-matched AND query so search-as-you-type works without
// exposing FTS5 syntax to callers. Results are ordered by bm25 relevance.
func (s *Store) SearchFTS(query string, limit int, workbookID string) ([]FTSResult, error) {
	matchExpr := buildFTSMatch(query)
	if matchExpr == "" {
		return []FTSResult{}, nil
	}
	if limit <= 0 {
		limit = 20
	}

	sql := `SELECT topic_id, workbook_id, workbook_title, sheet_id, title, notes,
	               snippet(topics_fts, 0, '<mark>', '</mark>', '…', 12) AS ctx,
	               bm25(topics_fts) AS rank
	        FROM topics_fts
	        WHERE topics_fts MATCH ?`
	args := []any{matchExpr}
	if workbookID != "" {
		sql += ` AND workbook_id = ?`
		args = append(args, workbookID)
	}
	sql += ` ORDER BY rank LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.Query(sql, args...)
	if err != nil {
		return nil, fmt.Errorf("fts query: %w", err)
	}
	defer rows.Close()

	results := []FTSResult{}
	for rows.Next() {
		var r FTSResult
		if err := rows.Scan(&r.TopicID, &r.WorkbookID, &r.WorkbookTitle, &r.SheetID,
			&r.Title, &r.Notes, &r.Context, &r.Rank); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// CountFTS returns the number of indexed topics.
func (s *Store) CountFTS() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM topics_fts`).Scan(&n)
	return n, err
}

// buildFTSMatch converts a free-text query into a safe FTS5 MATCH expression.
// Each whitespace-separated token is quoted (to neutralise FTS5 operators) and
// given a prefix wildcard, then AND-combined. Returns "" when no usable token.
func buildFTSMatch(query string) string {
	fields := strings.Fields(query)
	if len(fields) == 0 {
		return ""
	}
	parts := make([]string, 0, len(fields))
	for _, f := range fields {
		// Escape embedded double quotes per FTS5 string rules (" -> "").
		escaped := strings.ReplaceAll(f, `"`, `""`)
		parts = append(parts, fmt.Sprintf(`"%s"*`, escaped))
	}
	return strings.Join(parts, " ")
}
