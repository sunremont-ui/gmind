package api

import (
	"net/http"

	ms "github.com/gmind/backend/internal/model_servers"
)

type ModelServersHandler struct {
	configPath string
}

func NewModelServersHandler(configPath string) *ModelServersHandler {
	return &ModelServersHandler{configPath: configPath}
}

func (h *ModelServersHandler) List(w http.ResponseWriter, r *http.Request) {
	cfg, err := ms.Load(h.configPath)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (h *ModelServersHandler) Save(w http.ResponseWriter, r *http.Request) {
	var cfg ms.Config
	if err := decodeJSON(r, &cfg); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := ms.Save(h.configPath, &cfg); err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}
