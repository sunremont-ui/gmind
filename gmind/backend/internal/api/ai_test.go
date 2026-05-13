package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAIGenerateNoWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/nonexistent/ai/generate", map[string]string{
		"prompt": "test", "sheet_id": "s1",
	}))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestAIGenerateInvalidBody(t *testing.T) {
	router, s := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/wb-id/ai/generate", map[string]string{}))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
	_ = s
}

func TestAIExpandNoWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/nonexistent/ai/expand", map[string]string{
		"sheet_id": "s1", "title": "test",
	}))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestAIImageGenerateEmptyPrompt(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/ai/image", map[string]string{
		"prompt": "",
	}))
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestAIImageGenerateInvalidBody(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/ai/image", map[string]string{}))
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestAIChatNoWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/nonexistent/ai/chat", map[string]string{
		"sheet_id": "s1", "message": "hello",
	}))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestAIChatInvalidBody(t *testing.T) {
	router, s := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/wb-id/ai/chat", map[string]string{}))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
	_ = s
}

func TestSwitchAIProviderInvalidBody(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/ai/provider", bytes.NewReader([]byte(`{bad}`))))
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}
