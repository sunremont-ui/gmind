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
	h := &LlamaHandler{server: s, cfgPath: cfgPath}
	// try to load existing config so AvailableModels uses configured path
	if cfgPath != "" {
		_ = s.LoadConfig(cfgPath)
	}
	return h
}

func (h *LlamaHandler) Models() []string {
	return h.server.AvailableModels()
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

// LlamaFleetHandler exposes the multi-model manager: list models, start/stop
// individual model instances on configurable ports.
type LlamaFleetHandler struct {
	mgr *llama.Manager
}

func NewLlamaFleetHandler(mgr *llama.Manager) *LlamaFleetHandler {
	return &LlamaFleetHandler{mgr: mgr}
}

// ListModels returns every discovered model plus running state.
func (h *LlamaFleetHandler) ListModels(w http.ResponseWriter, r *http.Request) {
	models := h.mgr.List()
	if models == nil {
		models = []llama.ModelInfo{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"models_dir": h.mgr.ModelsDir(),
		"models":     models,
		"running":    h.mgr.Running(),
	})
}

// StartModel launches a model on the requested port.
func (h *LlamaFleetHandler) StartModel(w http.ResponseWriter, r *http.Request) {
	var req llama.StartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	inst, err := h.mgr.Start(req)
	if err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "started",
		"instance": inst,
	})
}

// StopModel terminates a running model instance.
func (h *LlamaFleetHandler) StopModel(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.mgr.Stop(req.Path); err != nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "stopped"})
}
