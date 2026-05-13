package api

import (
	"context"
	"net/http"

	"github.com/gmind/backend/internal/ai"
)

type contextKey string

const aiClientKey contextKey = "ai_client"

func AIContextMiddleware(aiClient *ai.AI) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), aiClientKey, aiClient)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func aiFromContext(ctx context.Context) *ai.AI {
	if aiClient, ok := ctx.Value(aiClientKey).(*ai.AI); ok {
		return aiClient
	}
	return nil
}

func (h *Handler) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	h.hub.HandleWebSocket(w, r)
}
