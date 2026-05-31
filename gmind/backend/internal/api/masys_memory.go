package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
)

// V6.0 — MASys Memory Bridge.
//
// Thin REST proxy from Gmind to MASys tRPC, with cache and unified shape.
// MASys tRPC URL convention:
//   GET  /trpc/<router>.<method>?input=<urlencoded JSON>
//   POST /trpc/<router>.<method>  body: <JSON>
// Response shape: { result: { data: <payload> } }
//
// We unwrap `.result.data` and forward to the client as plain JSON.

const (
	masysProxyTimeout = 15 * time.Second
)

func (h *Handler) masysURL() string {
	if h.maSysBaseURL != "" {
		return h.maSysBaseURL
	}
	return "http://localhost:3000"
}

// callTRPCQuery makes a GET request to MASys tRPC and unwraps result.data.
func (h *Handler) callTRPCQuery(ctx context.Context, method string, input map[string]any) (json.RawMessage, error) {
	endpoint := h.masysURL() + "/trpc/" + method
	if len(input) > 0 {
		raw, err := json.Marshal(input)
		if err != nil {
			return nil, fmt.Errorf("marshal input: %w", err)
		}
		endpoint += "?input=" + url.QueryEscape(string(raw))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: masysProxyTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("trpc %s: %w", method, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("trpc %s: %s (%d)", method, strings.TrimSpace(string(body)), resp.StatusCode)
	}
	var wrapped struct {
		Result struct {
			Data json.RawMessage `json:"data"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, fmt.Errorf("decode trpc response: %w (body: %s)", err, string(body))
	}
	if wrapped.Error != nil {
		return nil, fmt.Errorf("trpc %s: %s", method, wrapped.Error.Message)
	}
	if len(wrapped.Result.Data) == 0 {
		return json.RawMessage(`null`), nil
	}
	return wrapped.Result.Data, nil
}

// callTRPCMutation does the same with POST + body.
func (h *Handler) callTRPCMutation(ctx context.Context, method string, input map[string]any) (json.RawMessage, error) {
	endpoint := h.masysURL() + "/trpc/" + method
	bodyBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: masysProxyTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("trpc %s: %w", method, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("trpc %s: %s (%d)", method, strings.TrimSpace(string(body)), resp.StatusCode)
	}
	var wrapped struct {
		Result struct {
			Data json.RawMessage `json:"data"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(body, &wrapped); err != nil {
		return nil, fmt.Errorf("decode trpc response: %w (body: %s)", err, string(body))
	}
	if wrapped.Error != nil {
		return nil, fmt.Errorf("trpc %s: %s", method, wrapped.Error.Message)
	}
	if len(wrapped.Result.Data) == 0 {
		return json.RawMessage(`null`), nil
	}
	return wrapped.Result.Data, nil
}

// writeMASysJSON forwards a tRPC payload to the client with the proper headers.
func (h *Handler) writeMASysJSON(w http.ResponseWriter, data json.RawMessage, err error) {
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Source", "masys-proxy")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// MASysListEpisodes — GET /api/v1/masys/memory/episodes?namespace=...&limit=...
func (h *Handler) MASysListEpisodes(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	if lim := r.URL.Query().Get("limit"); lim != "" {
		// pass through as string; tRPC will coerce
		input["limit"] = lim
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.episode.recent", input)
	h.writeMASysJSON(w, data, err)
}

// MASysListEntities — GET /api/v1/masys/memory/entities?namespace=...
func (h *Handler) MASysListEntities(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.entity.list", input)
	h.writeMASysJSON(w, data, err)
}

// MASysListSkills — proxy to workspaces.skills or memory.skill.list.
func (h *Handler) MASysListSkills(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.skill.list", input)
	if err != nil {
		// fallback to workspace skills
		data, err = h.callTRPCQuery(r.Context(), "workspaces.skills", input)
	}
	h.writeMASysJSON(w, data, err)
}

// MASysListConversations — GET /api/v1/masys/memory/conversations?namespace=...
func (h *Handler) MASysListConversations(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.conversation.list", input)
	h.writeMASysJSON(w, data, err)
}

// MASysListWiki — GET /api/v1/masys/memory/wiki?namespace=...
func (h *Handler) MASysListWiki(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.wiki.list", input)
	h.writeMASysJSON(w, data, err)
}

// MASysListResults — GET /api/v1/masys/memory/results?namespace=...
func (h *Handler) MASysListResults(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.result.list", input)
	h.writeMASysJSON(w, data, err)
}

// MASysListDecisions — GET /api/v1/masys/memory/decisions?namespace=...
func (h *Handler) MASysListDecisions(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.controller.decisions", input)
	h.writeMASysJSON(w, data, err)
}

// MASysListPending — GET /api/v1/masys/memory/pending?namespace=...
func (h *Handler) MASysListPending(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.controller.pending", input)
	h.writeMASysJSON(w, data, err)
}

// MASysListNamespaces — discovery endpoint for the UI namespace switcher.
func (h *Handler) MASysListNamespaces(w http.ResponseWriter, r *http.Request) {
	data, err := h.callTRPCQuery(r.Context(), "memory.entity.namespaces", nil)
	h.writeMASysJSON(w, data, err)
}

// MASysMemoryRecall — POST /api/v1/masys/memory/recall
// Body: { namespace, query, limit }
func (h *Handler) MASysMemoryRecall(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.retriever.search", body)
	h.writeMASysJSON(w, data, err)
}

// MASysListRuns — GET /api/v1/masys/runs?limit=...
func (h *Handler) MASysListRuns(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if lim := r.URL.Query().Get("limit"); lim != "" {
		input["limit"] = lim
	}
	data, err := h.callTRPCQuery(r.Context(), "runs.list", input)
	h.writeMASysJSON(w, data, err)
}

// MASysGetRun — GET /api/v1/masys/runs/{runID}
func (h *Handler) MASysGetRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "runID required")
		return
	}
	data, err := h.callTRPCQuery(r.Context(), "runs.get", map[string]any{"id": runID})
	h.writeMASysJSON(w, data, err)
}

// MASysGetRunEvents — GET /api/v1/masys/runs/{runID}/events
func (h *Handler) MASysGetRunEvents(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "runID required")
		return
	}
	data, err := h.callTRPCQuery(r.Context(), "runs.events", map[string]any{"runId": runID})
	h.writeMASysJSON(w, data, err)
}

// MASysHealth — quick reachability check.
func (h *Handler) MASysHealth(w http.ResponseWriter, r *http.Request) {
	client := &http.Client{Timeout: 3 * time.Second}
	req, _ := http.NewRequestWithContext(r.Context(), http.MethodGet, h.masysURL()+"/health", nil)
	resp, err := client.Do(req)
	status := map[string]any{"base_url": h.masysURL()}
	if err != nil || resp.StatusCode != 200 {
		status["reachable"] = false
		if err != nil {
			status["error"] = err.Error()
		}
	} else {
		status["reachable"] = true
		defer resp.Body.Close()
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(status)
}
