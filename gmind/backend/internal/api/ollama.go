package api

import (
	"net/http"

	"github.com/gmind/backend/internal/ai"
)

type OllamaHandler struct {
	detector *ai.OllamaDetector
}

func (h *OllamaHandler) Detector() *ai.OllamaDetector {
	return h.detector
}

func NewOllamaHandler(detector *ai.OllamaDetector) *OllamaHandler {
	return &OllamaHandler{detector: detector}
}

func (h *OllamaHandler) Status(w http.ResponseWriter, r *http.Request) {
	detected, models := h.detector.Status()
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"detected": detected,
		"models":   models,
		"base_url": h.detector.BaseURL(),
	})
}
