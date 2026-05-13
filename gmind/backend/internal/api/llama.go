package api

import (
	"encoding/json"
	"net/http"

	"github.com/gmind/backend/internal/llama"
)

type LlamaHandler struct {
	server  *llama.Server
	cfgPath string
}

func NewLlamaHandler(s *llama.Server, cfgPath string) *LlamaHandler {
	return &LlamaHandler{server: s, cfgPath: cfgPath}
}

func (h *LlamaHandler) Status(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"running": h.server.IsRunning(),
		"config":  h.server.Config(),
	})
}

func (h *LlamaHandler) Start(w http.ResponseWriter, r *http.Request) {
	if h.server.IsRunning() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "Server already running"})
		return
	}
	if err := h.server.Start(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "started",
		"config": h.server.Config(),
	})
}

func (h *LlamaHandler) Stop(w http.ResponseWriter, r *http.Request) {
	if !h.server.IsRunning() {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "Server not running"})
		return
	}
	if err := h.server.Stop(); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}

func (h *LlamaHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var cfg llama.Config
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		writeError(w, http.StatusBadRequest, "invalid config")
		return
	}
	h.server.UpdateConfig(cfg)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "updated",
		"config": h.server.Config(),
	})
}

func (h *LlamaHandler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	if err := h.server.SaveConfig(h.cfgPath); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "saved"})
}
