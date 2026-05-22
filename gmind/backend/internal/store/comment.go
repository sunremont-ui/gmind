package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/gmind/backend/internal/model"
)

// CommentStore provides SQLite persistence for comments on topics.
type CommentStore struct {
	db *sql.DB
}

func NewCommentStore(db *sql.DB) *CommentStore {
	return &CommentStore{db: db}
}

func (cs *CommentStore) Create(comment *model.Comment) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := cs.db.Exec(
		`INSERT INTO comments (id, topic_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		comment.ID, comment.TopicID, comment.UserID, comment.Content, now, now,
	)
	return err
}

func (cs *CommentStore) ListByTopic(topicID string) ([]*model.Comment, error) {
	rows, err := cs.db.Query(
		`SELECT id, topic_id, user_id, content, created_at, updated_at FROM comments WHERE topic_id = ? ORDER BY created_at ASC`,
		topicID,
	)
	if err != nil {
		return nil, fmt.Errorf("list comments: %w", err)
	}
	defer rows.Close()

	var comments []*model.Comment
	for rows.Next() {
		c := &model.Comment{}
		var createdAt, updatedAt string
		if err := rows.Scan(&c.ID, &c.TopicID, &c.UserID, &c.Content, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		c.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		c.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
		comments = append(comments, c)
	}
	return comments, nil
}

func (cs *CommentStore) Delete(id string) error {
	_, err := cs.db.Exec(`DELETE FROM comments WHERE id = ?`, id)
	return err
}

// CountsByTopics returns a map of topic_id → comment count for the given topic IDs.
func (cs *CommentStore) CountsByTopics(topicIDs []string) (map[string]int, error) {
	if len(topicIDs) == 0 {
		return map[string]int{}, nil
	}
	placeholders := strings.Repeat("?,", len(topicIDs))
	placeholders = placeholders[:len(placeholders)-1]
	args := make([]any, len(topicIDs))
	for i, id := range topicIDs {
		args[i] = id
	}
	rows, err := cs.db.Query(
		`SELECT topic_id, COUNT(*) FROM comments WHERE topic_id IN (`+placeholders+`) GROUP BY topic_id`,
		args...,
	)
	if err != nil {
		return nil, fmt.Errorf("count comments: %w", err)
	}
	defer rows.Close()
	result := map[string]int{}
	for rows.Next() {
		var tid string
		var cnt int
		if err := rows.Scan(&tid, &cnt); err != nil {
			return nil, err
		}
		result[tid] = cnt
	}
	return result, nil
}