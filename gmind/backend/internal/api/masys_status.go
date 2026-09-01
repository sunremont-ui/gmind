package api

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Подключение к MASys «из коробки»: адрес не нужно настраивать руками.
// При старте бэкенд обходит список кандидатов, запоминает первый живой и
// дальше периодически проверяет связь в фоне — UI читает готовый статус,
// а не ждёт сетевой таймаут на каждый запрос.

// MASysCandidates — где искать MASys. Первым идёт настроенный адрес,
// затем штатный порт бэкенда MASys и исторические варианты.
var MASysCandidates = []string{
	"http://localhost:5010",
	"http://127.0.0.1:5010",
	"http://localhost:3000",
	"http://localhost:3001",
}

const (
	masysProbeTimeout  = 2 * time.Second
	masysProbeInterval = 20 * time.Second
)

// MASysStatus — снимок связи с MASys, отдаётся фронтенду.
type MASysStatus struct {
	BaseURL   string `json:"base_url"`
	Reachable bool   `json:"reachable"`
	LatencyMS int64  `json:"latency_ms,omitempty"`
	CheckedAt string `json:"checked_at,omitempty"`
	Error     string `json:"error,omitempty"`
	// Discovered — адрес найден автопоиском, а не задан явно.
	Discovered bool `json:"discovered,omitempty"`
	// Candidates — что перебирали, чтобы в UI было видно, куда стучались.
	Candidates []string `json:"candidates,omitempty"`
}

type masysMonitor struct {
	mu         sync.RWMutex
	status     MASysStatus
	configured string // адрес из конфига/настроек пользователя
	configPath string // файл, где хранится выбранный пользователем адрес
	onChange   func(baseURL string)
	// notified — адрес, о котором уже сообщили потребителям (инструментам агентов).
	// Отдельно от status.BaseURL: о первом успешном подключении тоже надо сказать.
	notified string
	stop     chan struct{}
	once     sync.Once
}

type masysSettings struct {
	BaseURL string `json:"base_url"`
}

func newMASysMonitor(configured, configPath string, onChange func(string)) *masysMonitor {
	m := &masysMonitor{
		configured: configured,
		configPath: configPath,
		onChange:   onChange,
		stop:       make(chan struct{}),
	}
	// Сохранённый пользователем адрес важнее значения из окружения.
	if saved := m.loadSaved(); saved != "" {
		m.configured = saved
	}
	m.status = MASysStatus{BaseURL: m.configured, Candidates: m.candidates()}
	return m
}

func (m *masysMonitor) candidates() []string {
	seen := map[string]bool{}
	var out []string
	add := func(u string) {
		if u == "" || seen[u] {
			return
		}
		seen[u] = true
		out = append(out, u)
	}
	add(m.configured)
	for _, c := range MASysCandidates {
		add(c)
	}
	return out
}

// Start запускает первичный поиск и фоновые перепроверки.
func (m *masysMonitor) Start() {
	m.once.Do(func() {
		go func() {
			m.Probe(context.Background())
			t := time.NewTicker(masysProbeInterval)
			defer t.Stop()
			for {
				select {
				case <-m.stop:
					return
				case <-t.C:
					m.Probe(context.Background())
				}
			}
		}()
	})
}

func (m *masysMonitor) Stop() {
	select {
	case <-m.stop:
	default:
		close(m.stop)
	}
}

// Probe перебирает кандидатов и запоминает первого ответившего.
func (m *masysMonitor) Probe(ctx context.Context) MASysStatus {
	cands := m.candidates()
	configured := m.currentConfigured()

	var firstErr string
	for _, base := range cands {
		start := time.Now()
		if err := pingMASys(ctx, base); err != nil {
			if firstErr == "" {
				firstErr = err.Error()
			}
			continue
		}
		st := MASysStatus{
			BaseURL:    base,
			Reachable:  true,
			LatencyMS:  time.Since(start).Milliseconds(),
			CheckedAt:  time.Now().UTC().Format(time.RFC3339),
			Discovered: base != configured,
			Candidates: cands,
		}
		m.set(st)
		return st
	}

	st := MASysStatus{
		BaseURL:    configured,
		Reachable:  false,
		CheckedAt:  time.Now().UTC().Format(time.RFC3339),
		Error:      firstErr,
		Candidates: cands,
	}
	m.set(st)
	return st
}

func pingMASys(ctx context.Context, base string) error {
	ctx, cancel := context.WithTimeout(ctx, masysProbeTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := (&http.Client{Timeout: masysProbeTimeout}).Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return &httpStatusError{code: resp.StatusCode}
	}
	return nil
}

type httpStatusError struct{ code int }

func (e *httpStatusError) Error() string { return "MASys /health returned status " + itoa(e.code) }

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [8]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func (m *masysMonitor) set(st MASysStatus) {
	m.mu.Lock()
	changed := st.Reachable && st.BaseURL != m.notified
	m.status = st
	if changed {
		m.notified = st.BaseURL
	}
	m.mu.Unlock()
	if changed && m.onChange != nil {
		m.onChange(st.BaseURL)
	}
}

func (m *masysMonitor) Status() MASysStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

// EffectiveURL — адрес, по которому реально ходить: живой найденный или настроенный.
func (m *masysMonitor) EffectiveURL() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.status.Reachable && m.status.BaseURL != "" {
		return m.status.BaseURL
	}
	return m.configured
}

func (m *masysMonitor) currentConfigured() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.configured
}

// SetBaseURL задаёт адрес вручную, сохраняет его и сразу перепроверяет связь.
func (m *masysMonitor) SetBaseURL(ctx context.Context, base string) MASysStatus {
	m.mu.Lock()
	m.configured = base
	m.mu.Unlock()
	m.saveSelected(base)
	return m.Probe(ctx)
}

func (m *masysMonitor) loadSaved() string {
	if m.configPath == "" {
		return ""
	}
	data, err := os.ReadFile(m.configPath)
	if err != nil {
		return ""
	}
	var s masysSettings
	if err := json.Unmarshal(data, &s); err != nil {
		return ""
	}
	return s.BaseURL
}

func (m *masysMonitor) saveSelected(base string) {
	if m.configPath == "" {
		return
	}
	_ = os.MkdirAll(filepath.Dir(m.configPath), 0o755)
	data, err := json.MarshalIndent(masysSettings{BaseURL: base}, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(m.configPath, data, 0o644)
}

// ─────────────────────── HTTP handlers ───────────────────────

// MASysHealth — GET /api/v1/masys/health[?refresh=1]
// Отдаёт кэшированный статус мгновенно; refresh=1 форсирует проверку.
func (h *Handler) MASysHealth(w http.ResponseWriter, r *http.Request) {
	if h.masysMonitor == nil {
		writeJSON(w, http.StatusOK, MASysStatus{BaseURL: h.masysURL(), Reachable: false, Error: "monitor not started"})
		return
	}
	st := h.masysMonitor.Status()
	if r.URL.Query().Get("refresh") == "1" || st.CheckedAt == "" {
		st = h.masysMonitor.Probe(r.Context())
	}
	writeJSON(w, http.StatusOK, st)
}

type masysConfigRequest struct {
	BaseURL string `json:"base_url"`
}

// MASysSetConfig — PUT /api/v1/masys/config {base_url}
func (h *Handler) MASysSetConfig(w http.ResponseWriter, r *http.Request) {
	var req masysConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.BaseURL == "" {
		writeError(w, http.StatusBadRequest, "base_url is required")
		return
	}
	if h.masysMonitor == nil {
		h.maSysBaseURL = req.BaseURL
		writeJSON(w, http.StatusOK, MASysStatus{BaseURL: req.BaseURL})
		return
	}
	st := h.masysMonitor.SetBaseURL(r.Context(), req.BaseURL)
	writeJSON(w, http.StatusOK, st)
}
