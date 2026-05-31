package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
)

// V6.0 — SSE bridge for MASys run events.
//
// Gmind frontend can't easily speak MASys WS (different origin, complex auth).
// We bridge by connecting Gmind backend → MASys WS, then re-emit events as SSE
// to the Gmind frontend. One WS connection per active SSE client (no fan-out yet).
//
// Frontend usage:
//   const es = new EventSource('/api/v1/masys/runs/<runId>/stream')
//   es.addEventListener('event', (e) => { const ev = JSON.parse(e.data); ... })

func wsURLFromHTTP(httpURL string) string {
	if strings.HasPrefix(httpURL, "https://") {
		return "wss://" + strings.TrimPrefix(httpURL, "https://")
	}
	if strings.HasPrefix(httpURL, "http://") {
		return "ws://" + strings.TrimPrefix(httpURL, "http://")
	}
	return httpURL
}

// MASysRunStream — SSE endpoint that proxies MASys WebSocket events for a run.
// GET /api/v1/masys/runs/{runID}/stream
func (h *Handler) MASysRunStream(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "runID required")
		return
	}

	// SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	// Connect to MASys WS
	masysBase := h.masysURL()
	wsBase := wsURLFromHTTP(masysBase)
	target := wsBase + "/ws?" + url.Values{"runId": []string{runID}}.Encode()

	conn, _, err := websocket.DefaultDialer.DialContext(ctx, target, nil)
	if err != nil {
		fmt.Fprintf(w, "event: error\ndata: %q\n\n", "failed to connect to MASys: "+err.Error())
		flusher.Flush()
		return
	}
	defer conn.Close()

	// Send hello event
	fmt.Fprintf(w, "event: open\ndata: {\"run_id\":%q,\"masys\":%q}\n\n", runID, masysBase)
	flusher.Flush()

	// Read pump (from MASys WS → SSE)
	msgs := make(chan []byte, 16)
	errCh := make(chan error, 1)
	go func() {
		defer close(msgs)
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			select {
			case msgs <- message:
			case <-ctx.Done():
				return
			}
		}
	}()

	keepalive := time.NewTicker(20 * time.Second)
	defer keepalive.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-msgs:
			if !ok {
				return
			}
			eventName := eventTypeOf(msg)
			fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventName, msg)
			flusher.Flush()
		case <-keepalive.C:
			// SSE comment to keep connection open through proxies
			fmt.Fprint(w, ": keepalive\n\n")
			flusher.Flush()
		case err := <-errCh:
			fmt.Fprintf(w, "event: error\ndata: %q\n\n", err.Error())
			flusher.Flush()
			return
		}
	}
}

func eventTypeOf(msg []byte) string {
	var probe struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(msg, &probe); err == nil && probe.Type != "" {
		return sanitizeEventName(probe.Type)
	}
	return "message"
}

func sanitizeEventName(name string) string {
	// SSE event names must not contain newlines; replace any whitespace with dots.
	out := strings.Builder{}
	for _, r := range name {
		if r == '\n' || r == '\r' || r == '\t' || r == ' ' {
			out.WriteRune('.')
		} else {
			out.WriteRune(r)
		}
	}
	return out.String()
}
