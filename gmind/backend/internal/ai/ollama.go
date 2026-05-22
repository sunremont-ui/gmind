package ai

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

type OllamaModel struct {
	Name       string `json:"name"`
	ModifiedAt string `json:"modified_at,omitempty"`
	Size       int64  `json:"size,omitempty"`
}

type ollamaTagsResponse struct {
	Models []struct {
		Name       string `json:"name"`
		ModifiedAt string `json:"modified_at,omitempty"`
		Size       int64  `json:"size,omitempty"`
	} `json:"models"`
}

type OllamaDetector struct {
	mu       sync.RWMutex
	detected bool
	models   []OllamaModel
	baseURL  string
	stopCh   chan struct{}
}

func NewOllamaDetector(baseURL string) *OllamaDetector {
	if baseURL == "" {
		baseURL = "http://localhost:11434"
	}
	return &OllamaDetector{
		baseURL: strings.TrimRight(baseURL, "/"),
		stopCh:  make(chan struct{}),
	}
}

func (d *OllamaDetector) Start(interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	d.check()
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				d.check()
			case <-d.stopCh:
				return
			}
		}
	}()
}

func (d *OllamaDetector) Stop() {
	close(d.stopCh)
}

func (d *OllamaDetector) check() {
	detected, models := d.ping()
	d.mu.Lock()
	d.detected = detected
	d.models = models
	d.mu.Unlock()
}

func (d *OllamaDetector) ping() (bool, []OllamaModel) {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(d.baseURL + "/api/tags")
	if err != nil {
		return false, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return false, nil
	}

	var tagsResp ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&tagsResp); err != nil {
		return false, nil
	}

	models := make([]OllamaModel, 0, len(tagsResp.Models))
	for _, m := range tagsResp.Models {
		models = append(models, OllamaModel{
			Name:       m.Name,
			ModifiedAt: m.ModifiedAt,
			Size:       m.Size,
		})
	}
	return true, models
}

func (d *OllamaDetector) Status() (bool, []OllamaModel) {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.detected, d.models
}

func (d *OllamaDetector) BaseURL() string {
	return d.baseURL
}
