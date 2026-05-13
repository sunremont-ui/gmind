package mcp

import (
	"encoding/json"
	"io"
	"net/http"
)

// HTTPHandler returns an http.Handler that serves MCP over HTTP POST.
// It reads JSON-RPC requests from the body, processes them, and returns JSON-RPC responses.
func HTTPHandler(s *Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "failed to read body", http.StatusBadRequest)
			return
		}

		// Support both single request and batch arrays
		var raw json.RawMessage
		if err := json.Unmarshal(body, &raw); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		result := s.Handle(raw)

		w.Header().Set("Content-Type", "application/json")
		w.Write(result)
	}
}
