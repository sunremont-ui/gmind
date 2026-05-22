package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/gmind/backend/internal/model"
	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func New(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(on)")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	// In-memory SQLite is per-connection; pin to one connection so all
	// queries share the same database and see tables created by migrations.
	if dbPath == ":memory:" {
		db.SetMaxOpenConns(1)
	}

	store := &Store{db: db}
	if err := store.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return store, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

// DB returns the underlying *sql.DB for use by other stores.
func (s *Store) DB() *sql.DB {
	return s.db
}

// Workbook CRUD

func (s *Store) CreateWorkbook(wb *model.Workbook) error {
	data, err := json.Marshal(wb)
	if err != nil {
		return fmt.Errorf("marshal workbook: %w", err)
	}

	_, err = s.db.Exec(
		`INSERT INTO workbooks (id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
		wb.ID, wb.Title, string(data), wb.CreatedAt.Format(time.RFC3339), wb.UpdatedAt.Format(time.RFC3339),
	)
	return err
}

func (s *Store) GetWorkbook(id string) (*model.Workbook, error) {
	var dataStr string
	err := s.db.QueryRow(`SELECT data FROM workbooks WHERE id = ?`, id).Scan(&dataStr)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get workbook: %w", err)
	}

	var wb model.Workbook
	if err := json.Unmarshal([]byte(dataStr), &wb); err != nil {
		return nil, fmt.Errorf("unmarshal workbook: %w", err)
	}
	return &wb, nil
}

func (s *Store) ListWorkbooks() ([]*model.Workbook, error) {
	rows, err := s.db.Query(`SELECT data FROM workbooks ORDER BY updated_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("list workbooks: %w", err)
	}
	defer rows.Close()

	var workbooks []*model.Workbook
	for rows.Next() {
		var dataStr string
		if err := rows.Scan(&dataStr); err != nil {
			return nil, err
		}
		var wb model.Workbook
		if err := json.Unmarshal([]byte(dataStr), &wb); err != nil {
			return nil, err
		}
		workbooks = append(workbooks, &wb)
	}
	return workbooks, nil
}

func (s *Store) UpdateWorkbook(wb *model.Workbook) error {
	wb.UpdatedAt = time.Now().UTC()
	data, err := json.Marshal(wb)
	if err != nil {
		return fmt.Errorf("marshal workbook: %w", err)
	}

	_, err = s.db.Exec(
		`UPDATE workbooks SET title = ?, data = ?, updated_at = ? WHERE id = ?`,
		wb.Title, string(data), wb.UpdatedAt.Format(time.RFC3339), wb.ID,
	)
	return err
}

func (s *Store) DeleteWorkbook(id string) error {
	_, err := s.db.Exec(`DELETE FROM workbooks WHERE id = ?`, id)
	return err
}

// CommentStore
func (s *Store) CommentStore() *CommentStore {
	return NewCommentStore(s.db)
}

// Collaborators

func (s *Store) AddCollaborator(workbookID, userID, role string) error {
	_, err := s.db.Exec(
		`INSERT OR REPLACE INTO workbook_collaborators (workbook_id, user_id, role) VALUES (?, ?, ?)`,
		workbookID, userID, role,
	)
	return err
}

func (s *Store) RemoveCollaborator(workbookID, userID string) error {
	_, err := s.db.Exec(
		`DELETE FROM workbook_collaborators WHERE workbook_id = ? AND user_id = ?`,
		workbookID, userID,
	)
	return err
}

func (s *Store) GetCollaborators(workbookID string) ([]string, error) {
	rows, err := s.db.Query(
		`SELECT user_id FROM workbook_collaborators WHERE workbook_id = ?`, workbookID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []string
	for rows.Next() {
		var userID string
		if err := rows.Scan(&userID); err != nil {
			return nil, err
		}
		users = append(users, userID)
	}
	return users, nil
}
