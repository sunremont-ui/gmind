package store

import (
	"database/sql"
	"encoding/json"
	"time"
)

// EmbeddingRecord holds a topic's text and its vector embedding.
type EmbeddingRecord struct {
	TopicID    string    `json:"topic_id"`
	WorkbookID string    `json:"workbook_id"`
	SheetID    string    `json:"sheet_id"`
	Text       string    `json:"text"`
	Embedding  []float32 `json:"-"` // stored as JSON text in SQLite
	Model      string    `json:"model"`
	UpdatedAt  string    `json:"updated_at"`
}

// EmbeddingStore provides SQLite persistence for topic embeddings.
type EmbeddingStore struct {
	db *sql.DB
}

func NewEmbeddingStore(db *sql.DB) *EmbeddingStore {
	return &EmbeddingStore{db: db}
}

// Upsert inserts or replaces an embedding record.
func (es *EmbeddingStore) Upsert(r *EmbeddingRecord) error {
	embJSON, err := json.Marshal(r.Embedding)
	if err != nil {
		return err
	}
	if r.UpdatedAt == "" {
		r.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	_, err = es.db.Exec(
		`INSERT INTO topic_embeddings (topic_id, workbook_id, sheet_id, text, embedding, model, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(topic_id, workbook_id) DO UPDATE SET
		     sheet_id   = excluded.sheet_id,
		     text       = excluded.text,
		     embedding  = excluded.embedding,
		     model      = excluded.model,
		     updated_at = excluded.updated_at`,
		r.TopicID, r.WorkbookID, r.SheetID, r.Text, string(embJSON), r.Model, r.UpdatedAt,
	)
	return err
}

// List returns all embedding records (used for cosine search).
func (es *EmbeddingStore) List() ([]*EmbeddingRecord, error) {
	rows, err := es.db.Query(
		`SELECT topic_id, workbook_id, sheet_id, text, embedding, model, updated_at FROM topic_embeddings`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*EmbeddingRecord
	for rows.Next() {
		r := &EmbeddingRecord{}
		var embJSON string
		if err := rows.Scan(&r.TopicID, &r.WorkbookID, &r.SheetID, &r.Text, &embJSON, &r.Model, &r.UpdatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal([]byte(embJSON), &r.Embedding)
		records = append(records, r)
	}
	return records, nil
}

// Delete removes the embedding for a topic.
func (es *EmbeddingStore) Delete(topicID, workbookID string) error {
	_, err := es.db.Exec(
		`DELETE FROM topic_embeddings WHERE topic_id = ? AND workbook_id = ?`,
		topicID, workbookID,
	)
	return err
}

// Count returns the total number of indexed topics.
func (es *EmbeddingStore) Count() (int, error) {
	var n int
	err := es.db.QueryRow(`SELECT COUNT(*) FROM topic_embeddings`).Scan(&n)
	return n, err
}
