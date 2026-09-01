package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func fakeMASys(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestMonitorFindsConfiguredMASys(t *testing.T) {
	srv := fakeMASys(t)
	m := newMASysMonitor(srv.URL, filepath.Join(t.TempDir(), "masys.json"), nil)

	st := m.Probe(context.Background())
	if !st.Reachable || st.BaseURL != srv.URL {
		t.Fatalf("status = %+v, want reachable at %s", st, srv.URL)
	}
	if st.Discovered {
		t.Fatalf("configured URL should not be marked as discovered")
	}
	if m.EffectiveURL() != srv.URL {
		t.Fatalf("effective url = %q", m.EffectiveURL())
	}
}

func TestMonitorDiscoversFallbackCandidate(t *testing.T) {
	srv := fakeMASys(t)
	// Настроен мёртвый адрес, живой лежит среди кандидатов.
	prev := MASysCandidates
	MASysCandidates = []string{"http://127.0.0.1:1", srv.URL}
	t.Cleanup(func() { MASysCandidates = prev })

	m := newMASysMonitor("http://127.0.0.1:2", filepath.Join(t.TempDir(), "masys.json"), nil)
	st := m.Probe(context.Background())

	if !st.Reachable || st.BaseURL != srv.URL {
		t.Fatalf("status = %+v, want discovery of %s", st, srv.URL)
	}
	if !st.Discovered {
		t.Fatalf("fallback candidate must be flagged as discovered")
	}
}

func TestMonitorReportsUnreachable(t *testing.T) {
	prev := MASysCandidates
	MASysCandidates = []string{"http://127.0.0.1:1"}
	t.Cleanup(func() { MASysCandidates = prev })

	m := newMASysMonitor("http://127.0.0.1:2", filepath.Join(t.TempDir(), "masys.json"), nil)
	st := m.Probe(context.Background())

	if st.Reachable {
		t.Fatalf("status = %+v, want unreachable", st)
	}
	if st.Error == "" {
		t.Fatalf("unreachable status must carry an error")
	}
	// Даже без связи ходить надо по настроенному адресу, а не в пустоту.
	if m.EffectiveURL() != "http://127.0.0.1:2" {
		t.Fatalf("effective url = %q", m.EffectiveURL())
	}
}

func TestMonitorNotifiesOnConnect(t *testing.T) {
	srv := fakeMASys(t)
	got := make(chan string, 1)
	m := newMASysMonitor(srv.URL, filepath.Join(t.TempDir(), "masys.json"), func(u string) { got <- u })

	m.Probe(context.Background())
	select {
	case u := <-got:
		if u != srv.URL {
			t.Fatalf("callback url = %q, want %q", u, srv.URL)
		}
	default:
		t.Fatal("onChange was not called on first successful connect")
	}
}

func TestMonitorPersistsChosenURL(t *testing.T) {
	srv := fakeMASys(t)
	cfgPath := filepath.Join(t.TempDir(), "masys.json")

	m := newMASysMonitor("http://127.0.0.1:2", cfgPath, nil)
	if st := m.SetBaseURL(context.Background(), srv.URL); !st.Reachable {
		t.Fatalf("set base url status = %+v", st)
	}

	// Новый монитор поднимает сохранённый адрес вместо значения из окружения.
	again := newMASysMonitor("http://127.0.0.1:2", cfgPath, nil)
	if again.currentConfigured() != srv.URL {
		t.Fatalf("configured = %q, want saved %q", again.currentConfigured(), srv.URL)
	}
}

func TestMASysHealthEndpointReturnsCachedStatus(t *testing.T) {
	srv := fakeMASys(t)
	prev := MASysCandidates
	MASysCandidates = []string{srv.URL}
	t.Cleanup(func() { MASysCandidates = prev })

	router, _, _ := newMarkdownRouter(t)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/masys/health?refresh=1", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var st MASysStatus
	if err := json.Unmarshal(w.Body.Bytes(), &st); err != nil {
		t.Fatal(err)
	}
	if !st.Reachable || st.BaseURL != srv.URL {
		t.Fatalf("health = %+v, want reachable at %s", st, srv.URL)
	}
	if st.CheckedAt == "" {
		t.Fatalf("health must report when it was checked")
	}
}

func TestMASysConfigEndpointSwitchesURL(t *testing.T) {
	srv := fakeMASys(t)
	router, _, _ := newMarkdownRouter(t)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "PUT", "/api/v1/masys/config", map[string]string{"base_url": srv.URL}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var st MASysStatus
	if err := json.Unmarshal(w.Body.Bytes(), &st); err != nil {
		t.Fatal(err)
	}
	if !st.Reachable || st.BaseURL != srv.URL {
		t.Fatalf("config switch = %+v", st)
	}
}
