package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Note struct {
	ID         string   `json:"id"`
	Content    string   `json:"content"`
	Tags       []string `json:"tags"`
	Source     string   `json:"source"`
	WorkbookID string   `json:"workbook_id,omitempty"`
	TopicID    string   `json:"topic_id,omitempty"`
	Pinned     bool     `json:"pinned"`
	CreatedAt  string   `json:"created_at"`
	UpdatedAt  string   `json:"updated_at"`
}

type CreateNoteRequest struct {
	Content    string   `json:"content"`
	Tags       []string `json:"tags"`
	Source     string   `json:"source"`
	WorkbookID string   `json:"workbook_id"`
	TopicID    string   `json:"topic_id"`
	Pinned     bool     `json:"pinned"`
}

type UpdateNoteRequest struct {
	Content *string   `json:"content"`
	Tags    []string  `json:"tags"`
	Pinned  *bool     `json:"pinned"`
}

type NoteStore struct {
	db *sql.DB
}

func NewNoteStore(db *sql.DB) *NoteStore {
	return &NoteStore{db: db}
}

func (s *NoteStore) Create(req CreateNoteRequest) (*Note, error) {
	if req.Tags == nil {
		req.Tags = []string{}
	}
	if req.Source == "" {
		req.Source = "manual"
	}

	tagsJSON, err := json.Marshal(req.Tags)
	if err != nil {
		return nil, fmt.Errorf("marshal tags: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	note := &Note{
		ID:         uuid.New().String(),
		Content:    req.Content,
		Tags:       req.Tags,
		Source:     req.Source,
		WorkbookID: req.WorkbookID,
		TopicID:    req.TopicID,
		Pinned:     req.Pinned,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	_, err = s.db.Exec(
		`INSERT INTO notes (id, content, tags, source, workbook_id, topic_id, pinned, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		note.ID, note.Content, string(tagsJSON), note.Source,
		note.WorkbookID, note.TopicID, boolToInt(note.Pinned),
		note.CreatedAt, note.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert note: %w", err)
	}
	return note, nil
}

func (s *NoteStore) List(query string) ([]*Note, error) {
	var rows *sql.Rows
	var err error

	if query != "" {
		like := "%" + strings.ToLower(query) + "%"
		rows, err = s.db.Query(
			`SELECT id, content, tags, source, workbook_id, topic_id, pinned, created_at, updated_at
			 FROM notes
			 WHERE lower(content) LIKE ? OR lower(tags) LIKE ?
			 ORDER BY pinned DESC, created_at DESC`,
			like, like,
		)
	} else {
		rows, err = s.db.Query(
			`SELECT id, content, tags, source, workbook_id, topic_id, pinned, created_at, updated_at
			 FROM notes
			 ORDER BY pinned DESC, created_at DESC`,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("query notes: %w", err)
	}
	defer rows.Close()

	notes := make([]*Note, 0)
	for rows.Next() {
		n, err := scanNote(rows)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

func (s *NoteStore) Get(id string) (*Note, error) {
	row := s.db.QueryRow(
		`SELECT id, content, tags, source, workbook_id, topic_id, pinned, created_at, updated_at
		 FROM notes WHERE id = ?`, id,
	)
	return scanNote(row)
}

func (s *NoteStore) Update(id string, req UpdateNoteRequest) (*Note, error) {
	note, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	if note == nil {
		return nil, fmt.Errorf("note %s not found", id)
	}

	if req.Content != nil {
		note.Content = *req.Content
	}
	if req.Tags != nil {
		note.Tags = req.Tags
	}
	if req.Pinned != nil {
		note.Pinned = *req.Pinned
	}
	note.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	tagsJSON, _ := json.Marshal(note.Tags)
	_, err = s.db.Exec(
		`UPDATE notes SET content = ?, tags = ?, pinned = ?, updated_at = ? WHERE id = ?`,
		note.Content, string(tagsJSON), boolToInt(note.Pinned), note.UpdatedAt, id,
	)
	if err != nil {
		return nil, fmt.Errorf("update note: %w", err)
	}
	return note, nil
}

func (s *NoteStore) Delete(id string) error {
	_, err := s.db.Exec(`DELETE FROM notes WHERE id = ?`, id)
	return err
}

type scanner interface {
	Scan(dest ...any) error
}

func scanNote(row scanner) (*Note, error) {
	var n Note
	var tagsJSON string
	var pinned int
	err := row.Scan(
		&n.ID, &n.Content, &tagsJSON, &n.Source,
		&n.WorkbookID, &n.TopicID, &pinned, &n.CreatedAt, &n.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("scan note: %w", err)
	}
	n.Pinned = pinned != 0
	if err := json.Unmarshal([]byte(tagsJSON), &n.Tags); err != nil {
		n.Tags = []string{}
	}
	if n.Tags == nil {
		n.Tags = []string{}
	}
	return &n, nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
