package webhook

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Webhook struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	Events    []string  `json:"events"`
	Secret    string    `json:"secret"`
	CreatedAt time.Time `json:"created_at"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func generateSecret() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *Store) Create(url string, events []string) (*Webhook, error) {
	eventsJSON, err := json.Marshal(events)
	if err != nil {
		return nil, fmt.Errorf("marshal events: %w", err)
	}
	wh := &Webhook{
		ID:        uuid.New().String(),
		URL:       url,
		Events:    events,
		Secret:    generateSecret(),
		CreatedAt: time.Now().UTC(),
	}
	_, err = s.db.Exec(
		`INSERT INTO webhooks (id, url, events, secret, created_at) VALUES (?, ?, ?, ?, ?)`,
		wh.ID, wh.URL, string(eventsJSON), wh.Secret, wh.CreatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return nil, fmt.Errorf("insert webhook: %w", err)
	}
	return wh, nil
}

func (s *Store) List() ([]*Webhook, error) {
	rows, err := s.db.Query(`SELECT id, url, events, secret, created_at FROM webhooks ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []*Webhook
	for rows.Next() {
		var wh Webhook
		var eventsJSON, createdAt string
		if err := rows.Scan(&wh.ID, &wh.URL, &eventsJSON, &wh.Secret, &createdAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(eventsJSON), &wh.Events); err != nil {
			wh.Events = []string{}
		}
		wh.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
		result = append(result, &wh)
	}
	return result, rows.Err()
}

func (s *Store) Delete(id string) error {
	res, err := s.db.Exec(`DELETE FROM webhooks WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *Store) FindByEvent(event string) ([]*Webhook, error) {
	all, err := s.List()
	if err != nil {
		return nil, err
	}
	var matched []*Webhook
	for _, wh := range all {
		for _, e := range wh.Events {
			if e == event || e == "*" {
				matched = append(matched, wh)
				break
			}
		}
	}
	return matched, nil
}

// Notify fires webhook deliveries for an event in background goroutines.
func (s *Store) Notify(event string, payload any) {
	go func() {
		hooks, err := s.FindByEvent(event)
		if err != nil || len(hooks) == 0 {
			return
		}
		body, err := json.Marshal(map[string]any{
			"event":   event,
			"payload": payload,
		})
		if err != nil {
			return
		}
		for _, wh := range hooks {
			wh := wh
			go deliver(wh, event, body)
		}
	}()
}

func deliver(wh *Webhook, event string, body []byte) {
	mac := hmac.New(sha256.New, []byte(wh.Secret))
	mac.Write(body)
	sig := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, wh.URL, bytes.NewReader(body))
	if err != nil {
		log.Printf("webhook deliver %s: build request: %v", wh.ID, err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Gmind-Event", event)
	req.Header.Set("X-Gmind-Signature", sig)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if !strings.Contains(err.Error(), "context") {
			log.Printf("webhook deliver %s → %s: %v", wh.ID, wh.URL, err)
		}
		return
	}
	resp.Body.Close()
}
