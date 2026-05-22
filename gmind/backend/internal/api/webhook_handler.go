package api

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/gmind/backend/internal/webhook"
	"github.com/go-chi/chi/v5"
)

type createWebhookRequest struct {
	URL    string   `json:"url"`
	Events []string `json:"events"`
}

func (h *Handler) CreateWebhook(w http.ResponseWriter, r *http.Request) {
	if h.webhooks == nil {
		writeError(w, http.StatusServiceUnavailable, "webhooks not available")
		return
	}
	var req createWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "url is required")
		return
	}
	if len(req.Events) == 0 {
		writeError(w, http.StatusBadRequest, "events must not be empty")
		return
	}

	wh, err := h.webhooks.Create(req.URL, req.Events)
	if err != nil {
		internalError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, wh)
}

func (h *Handler) ListWebhooks(w http.ResponseWriter, r *http.Request) {
	if h.webhooks == nil {
		writeJSON(w, http.StatusOK, []*webhook.Webhook{})
		return
	}
	hooks, err := h.webhooks.List()
	if err != nil {
		internalError(w, err)
		return
	}
	if hooks == nil {
		hooks = []*webhook.Webhook{}
	}
	writeJSON(w, http.StatusOK, hooks)
}

func (h *Handler) DeleteWebhook(w http.ResponseWriter, r *http.Request) {
	if h.webhooks == nil {
		writeError(w, http.StatusServiceUnavailable, "webhooks not available")
		return
	}
	id := chi.URLParam(r, "webhookID")
	if err := h.webhooks.Delete(id); err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "webhook not found")
			return
		}
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
