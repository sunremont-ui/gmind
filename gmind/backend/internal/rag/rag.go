// Package rag provides semantic search over mindmap topics using OpenAI embeddings.
// Embeddings are stored as JSON in SQLite — no CGO or external dependencies required.
package rag

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	openai "github.com/sashabaranov/go-openai"
)

const embeddingModel = "text-embedding-3-small"

// SearchResult is a single semantic search hit.
type SearchResult struct {
	TopicID    string  `json:"topic_id"`
	WorkbookID string  `json:"workbook_id"`
	SheetID    string  `json:"sheet_id"`
	Text       string  `json:"text"`
	Score      float32 `json:"score"`
}

// Service provides embedding generation and cosine-similarity search.
type Service struct {
	client *openai.Client
	store  *store.EmbeddingStore
}

// New creates a RAG service. If apiKey is empty, Embed calls will return an error gracefully.
func New(apiKey, baseURL string, es *store.EmbeddingStore) *Service {
	cfg := openai.DefaultConfig(apiKey)
	// Only override BaseURL if it's not the default OpenAI endpoint,
	// because custom endpoints often don't support the embeddings API.
	if baseURL != "" && baseURL != "https://api.openai.com/v1" {
		cfg.BaseURL = baseURL
	}
	return &Service{
		client: openai.NewClientWithConfig(cfg),
		store:  es,
	}
}

// Embed generates a vector embedding for text via OpenAI text-embedding-3-small.
func (s *Service) Embed(ctx context.Context, text string) ([]float32, error) {
	resp, err := s.client.CreateEmbeddings(ctx, openai.EmbeddingRequest{
		Input: []string{text},
		Model: openai.SmallEmbedding3,
	})
	if err != nil {
		return nil, fmt.Errorf("embed: %w", err)
	}
	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("embed: empty response")
	}
	return resp.Data[0].Embedding, nil
}

// Index embeds a topic's text and stores the result.
func (s *Service) Index(ctx context.Context, topicID, workbookID, sheetID, text string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	emb, err := s.Embed(ctx, text)
	if err != nil {
		return err
	}
	return s.store.Upsert(&store.EmbeddingRecord{
		TopicID:    topicID,
		WorkbookID: workbookID,
		SheetID:    sheetID,
		Text:       text,
		Embedding:  emb,
		Model:      embeddingModel,
	})
}

// Search returns the top-k topics most semantically similar to query.
func (s *Service) Search(ctx context.Context, query string, limit int) ([]SearchResult, error) {
	if query == "" {
		return nil, fmt.Errorf("query is required")
	}
	if limit <= 0 {
		limit = 5
	}

	queryEmb, err := s.Embed(ctx, query)
	if err != nil {
		return nil, err
	}

	records, err := s.store.List()
	if err != nil {
		return nil, fmt.Errorf("load embeddings: %w", err)
	}

	type scored struct {
		rec   *store.EmbeddingRecord
		score float32
	}
	scored_results := make([]scored, 0, len(records))
	for _, rec := range records {
		if len(rec.Embedding) == 0 {
			continue
		}
		score := cosineSimilarity(queryEmb, rec.Embedding)
		scored_results = append(scored_results, scored{rec, score})
	}
	sort.Slice(scored_results, func(i, j int) bool {
		return scored_results[i].score > scored_results[j].score
	})
	if len(scored_results) > limit {
		scored_results = scored_results[:limit]
	}

	out := make([]SearchResult, len(scored_results))
	for i, r := range scored_results {
		out[i] = SearchResult{
			TopicID:    r.rec.TopicID,
			WorkbookID: r.rec.WorkbookID,
			SheetID:    r.rec.SheetID,
			Text:       r.rec.Text,
			Score:      r.score,
		}
	}
	return out, nil
}

// IndexAll indexes all existing topics asynchronously. Errors are silently ignored
// (e.g., no API key, rate limits). Designed to run as a background goroutine.
func (s *Service) IndexAll(ctx context.Context, st *store.Store) {
	workbooks, err := st.ListWorkbooks()
	if err != nil {
		return
	}
	for _, wb := range workbooks {
		for _, sheet := range wb.Sheets {
			indexTopicTree(ctx, s, wb.ID, sheet.ID, sheet.RootTopic)
		}
	}
}

func indexTopicTree(ctx context.Context, s *Service, workbookID, sheetID string, t *model.Topic) {
	if t == nil {
		return
	}
	text := t.Title
	if t.Notes != "" {
		text += "\n" + t.Notes
	}
	_ = s.Index(ctx, t.ID, workbookID, sheetID, text)
	for _, child := range t.Children {
		indexTopicTree(ctx, s, workbookID, sheetID, child)
	}
}

func cosineSimilarity(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	var dot, normA, normB float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		normA += float64(a[i]) * float64(a[i])
		normB += float64(b[i]) * float64(b[i])
	}
	if normA == 0 || normB == 0 {
		return 0
	}
	return float32(dot / (math.Sqrt(normA) * math.Sqrt(normB)))
}
