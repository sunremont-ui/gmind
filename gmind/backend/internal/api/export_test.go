package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExportXMindNoWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/workbooks/nonexistent/export", nil))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d, body=%s", w.Code, http.StatusNotFound, w.Body.String())
	}
}

func TestImportXMind(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/workbooks/import", nil))
	// Expect bad request since no multipart file is provided
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestLlamaStatus(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/llama/status", nil))
	// Llama handler may return status or error, but not crash
	if w.Code != http.StatusOK && w.Code != http.StatusInternalServerError && w.Code != http.StatusServiceUnavailable {
		t.Errorf("status = %d, want 2xx or 5xx", w.Code)
	}
}
