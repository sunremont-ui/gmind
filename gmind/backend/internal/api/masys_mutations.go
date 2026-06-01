package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

// V6.1 — MASys Memory mutation bridge (write-back).
//
// The Memory Workbench was read-only through V6.0. These handlers proxy the
// curated set of MASys tRPC mutations that are safe to expose to the desktop
// UI: deleting stale items and running namespace-level maintenance.
//
// tRPC mutation convention (see callTRPCMutation): POST /trpc/<method> with the
// input object as the JSON body.

// decodeBody reads the request body into a generic map, tolerating an empty body.
func decodeBody(r *http.Request) (map[string]any, error) {
	body := map[string]any{}
	if r.Body == nil {
		return body, nil
	}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&body); err != nil && err.Error() != "EOF" {
		return nil, err
	}
	return body, nil
}

// MASysDeleteEpisode — DELETE /api/v1/masys/memory/episodes/{id}
func (h *Handler) MASysDeleteEpisode(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id required")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.episode.delete", map[string]any{"id": id})
	h.writeMASysJSON(w, data, err)
}

// MASysDeleteResult — DELETE /api/v1/masys/memory/results/{id}
func (h *Handler) MASysDeleteResult(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id required")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.result.delete", map[string]any{"id": id})
	h.writeMASysJSON(w, data, err)
}

// MASysDeleteExpiredResults — POST /api/v1/masys/memory/results/delete-expired
func (h *Handler) MASysDeleteExpiredResults(w http.ResponseWriter, r *http.Request) {
	data, err := h.callTRPCMutation(r.Context(), "memory.result.deleteExpired", map[string]any{})
	h.writeMASysJSON(w, data, err)
}

// MASysWriteWiki — POST /api/v1/masys/memory/wiki
// Body: { slug, title, content, namespace?, parentSlug?, tags? }
func (h *Handler) MASysWriteWiki(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body["slug"] == nil || body["title"] == nil {
		writeError(w, http.StatusBadRequest, "slug and title required")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.wiki.write", body)
	h.writeMASysJSON(w, data, err)
}

// MASysDeleteWiki — DELETE /api/v1/masys/memory/wiki/{slug}?namespace=...
func (h *Handler) MASysDeleteWiki(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		writeError(w, http.StatusBadRequest, "slug required")
		return
	}
	input := map[string]any{"slug": slug}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.wiki.delete", input)
	h.writeMASysJSON(w, data, err)
}

// MASysDeleteEntity — POST /api/v1/masys/memory/entities/delete
// Entities have a composite key (name+type+namespace), so we take a body.
// Body: { name, type, namespace? }
func (h *Handler) MASysDeleteEntity(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body["name"] == nil || body["type"] == nil {
		writeError(w, http.StatusBadRequest, "name and type required")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.entity.delete", body)
	h.writeMASysJSON(w, data, err)
}

// MASysMergeEntities — POST /api/v1/masys/memory/entities/merge
// Body: { sourceId, targetId }
func (h *Handler) MASysMergeEntities(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if body["sourceId"] == nil || body["targetId"] == nil {
		writeError(w, http.StatusBadRequest, "sourceId and targetId required")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.entity.merge", body)
	h.writeMASysJSON(w, data, err)
}

// MASysForgetSkills — POST /api/v1/masys/memory/skills/forget
// Body: { namespace?, minSuccessRate?, minUses?, unusedDays? } — deprecates
// low-quality / unused skills matching the criteria.
func (h *Handler) MASysForgetSkills(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.skill.forget", body)
	h.writeMASysJSON(w, data, err)
}

// MASysAcquireSkills — POST /api/v1/masys/memory/skills/acquire
// Body: { namespace?, minOccurrences?, lookback? } — distils skills from
// repeated successful episodes.
func (h *Handler) MASysAcquireSkills(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.skill.acquire", body)
	h.writeMASysJSON(w, data, err)
}
