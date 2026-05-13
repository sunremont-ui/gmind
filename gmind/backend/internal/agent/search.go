package agent

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// SearchResult represents a single web search result.
type SearchResult struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

// Searcher performs web searches.
type Searcher interface {
	Search(query string, maxResults int) ([]SearchResult, error)
}

// DuckDuckGoSearcher searches DuckDuckGo's HTML endpoint.
type DuckDuckGoSearcher struct {
	client *http.Client
}

func NewDuckDuckGoSearcher() *DuckDuckGoSearcher {
	return &DuckDuckGoSearcher{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (d *DuckDuckGoSearcher) Search(query string, maxResults int) ([]SearchResult, error) {
	data := url.Values{"q": {query}}
	resp, err := d.client.PostForm("https://html.duckduckgo.com/html/", data)
	if err != nil {
		return nil, fmt.Errorf("duckduckgo search: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	return parseDuckDuckGoResults(string(body), maxResults), nil
}

// parseDuckDuckGoResults extracts search results from DuckDuckGo HTML.
func parseDuckDuckGoResults(html string, max int) []SearchResult {
	var results []SearchResult

	// Find result blocks: <h2 class="result__title"> ... </h2>
	titleRe := regexp.MustCompile(`<a[^>]*class="result__a"[^>]*>(.*?)</a>`)
	snippetRe := regexp.MustCompile(`<a[^>]*class="result__snippet"[^>]*>(.*?)</a>`)
	urlRe := regexp.MustCompile(`<a[^>]*class="result__a"[^>]*href="([^"]+)"`)

	titleMatches := titleRe.FindAllStringSubmatch(html, -1)
	snippetMatches := snippetRe.FindAllStringSubmatch(html, -1)
	urlMatches := urlRe.FindAllStringSubmatch(html, -1)

	n := len(titleMatches)
	if len(urlMatches) < n {
		n = len(urlMatches)
	}
	if max > 0 && n > max {
		n = max
	}

	for i := 0; i < n; i++ {
		title := stripTags(titleMatches[i][1])
		u := urlMatches[i][1]
		var snippet string
		if i < len(snippetMatches) {
			snippet = stripTags(snippetMatches[i][1])
		}
		results = append(results, SearchResult{
			Title:   strings.TrimSpace(title),
			URL:     strings.TrimSpace(u),
			Snippet: strings.TrimSpace(snippet),
		})
	}

	if len(results) == 0 {
		// Fallback: extract from redirect links
		redirectRe := regexp.MustCompile(`uddg=([^&"]+)`)
		redirectMatches := redirectRe.FindAllStringSubmatch(html, -1)
		for i, m := range redirectMatches {
			if max > 0 && i >= max {
				break
			}
			decoded, err := url.QueryUnescape(m[1])
			if err != nil {
				continue
			}
			results = append(results, SearchResult{
				Title:   fmt.Sprintf("Result %d", i+1),
				URL:     decoded,
				Snippet: "",
			})
		}
	}

	return results
}

var stripTagRe = regexp.MustCompile(`<[^>]*>`)

func stripTags(s string) string {
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", "\"")
	s = strings.ReplaceAll(s, "&#x27;", "'")
	s = stripTagRe.ReplaceAllString(s, "")
	return s
}
