package wiki

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type Page struct {
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	Content   string    `json:"content"`
	Path      string    `json:"path"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type SearchResult struct {
	Slug    string `json:"slug"`
	Title   string `json:"title"`
	Snippet string `json:"snippet"`
	Score   int    `json:"score"`
}

type Store struct {
	mu        sync.RWMutex
	root      string
}

func NewStore(root string) (*Store, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("wiki root: %w", err)
	}
	if err := os.MkdirAll(abs, 0755); err != nil {
		return nil, fmt.Errorf("create wiki dir: %w", err)
	}
	return &Store{root: abs}, nil
}

func (s *Store) Root() string { return s.root }

func (s *Store) List() ([]Page, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entries, err := os.ReadDir(s.root)
	if err != nil {
		return nil, err
	}

	var pages []Page
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		slug := strings.TrimSuffix(e.Name(), ".md")
		if slug == "" {
			continue
		}
		p, err := s.readFile(slug)
		if err != nil {
			continue
		}
		pages = append(pages, *p)
	}

	sort.Slice(pages, func(i, j int) bool {
		return pages[i].Title < pages[j].Title
	})
	return pages, nil
}

func (s *Store) Read(slug string) (*Page, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.readFile(slug)
}

func (s *Store) readFile(slug string) (*Page, error) {
	path := filepath.Join(s.root, slug+".md")
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("wiki page %q not found", slug)
		}
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	title := extractTitle(string(data))
	return &Page{
		Slug:      slug,
		Title:     title,
		Content:   string(data),
		Path:      path,
		CreatedAt: info.ModTime(),
		UpdatedAt: info.ModTime(),
	}, nil
}

func (s *Store) Write(slug, content string) (*Page, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if slug == "" {
		return nil, fmt.Errorf("slug cannot be empty")
	}
	path := filepath.Join(s.root, slug+".md")

	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		return nil, err
	}

	title := extractTitle(content)
	return &Page{
		Slug:      slug,
		Title:     title,
		Content:   content,
		Path:      path,
		UpdatedAt: time.Now(),
	}, nil
}

func (s *Store) Delete(slug string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	path := filepath.Join(s.root, slug+".md")
	if err := os.Remove(path); err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("wiki page %q not found", slug)
		}
		return err
	}
	return nil
}

func (s *Store) Search(query string, maxResults int) ([]SearchResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if maxResults <= 0 {
		maxResults = 10
	}

	entries, err := os.ReadDir(s.root)
	if err != nil {
		return nil, err
	}

	query = strings.ToLower(query)
	terms := strings.Fields(query)

	var results []SearchResult
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		slug := strings.TrimSuffix(e.Name(), ".md")
		if slug == "" {
			continue
		}

		p, err := s.readFile(slug)
		if err != nil {
			continue
		}

		score := scorePage(p, terms)
		if score > 0 {
			snippet := makeSnippet(p.Content, query, 120)
			results = append(results, SearchResult{
				Slug:    p.Slug,
				Title:   p.Title,
				Snippet: snippet,
				Score:   score,
			})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > maxResults {
		results = results[:maxResults]
	}

	return results, nil
}

func extractTitle(content string) string {
	for _, line := range strings.Split(content, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimPrefix(trimmed, "# ")
		}
	}
	lines := strings.Split(strings.TrimSpace(content), "\n")
	if len(lines) > 0 && lines[0] != "" {
		return lines[0]
	}
	return "Untitled"
}

func scorePage(p *Page, terms []string) int {
	score := 0
	lowerContent := strings.ToLower(p.Content)
	lowerTitle := strings.ToLower(p.Title)

	for _, term := range terms {
		if strings.Contains(lowerTitle, term) {
			score += 10
		}
		if strings.Contains(lowerContent, term) {
			score += 3
		}
		score += strings.Count(lowerContent, term)
	}
	return score
}

func makeSnippet(content, query string, maxLen int) string {
	lower := strings.ToLower(content)
	lowerQuery := strings.ToLower(query)

	idx := strings.Index(lower, lowerQuery)
	if idx < 0 {
		if len(content) > maxLen {
			return content[:maxLen] + "..."
		}
		return content
	}

	start := idx - maxLen/3
	if start < 0 {
		start = 0
	}
	end := start + maxLen
	if end > len(content) {
		end = len(content)
	}

	snippet := content[start:end]
	if start > 0 {
		snippet = "... " + snippet
	}
	if end < len(content) {
		snippet = snippet + " ..."
	}
	return snippet
}
