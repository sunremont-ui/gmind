package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListAgentsEmptyWhenNoModule(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/agents/agents", nil))
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var list []interface{}
	json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 0 {
		t.Errorf("agents = %v, want empty", list)
	}
}

func TestListTasksEmptyWhenNoModule(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/agents/tasks", nil))
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var list []interface{}
	json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 0 {
		t.Errorf("tasks = %v, want empty", list)
	}
}

func TestListModules(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/modules", nil))
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
	var list []interface{}
	json.Unmarshal(w.Body.Bytes(), &list)
	if len(list) != 0 {
		t.Errorf("modules = %v, want empty", list)
	}
}
