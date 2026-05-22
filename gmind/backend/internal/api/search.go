package api

import (
	"net/http"
	"strconv"

	"github.com/gmind/backend/internal/rag"
)

// SearchHandler handles semantic search requests.
type SearchHandler struct {
	ragService *rag.Service
}

func NewSearchHandler(svc *rag.Service) *SearchHandler {
	return &SearchHandler{ragService: svc}
}

// Search handles GET /api/v1/search?q=...&limit=5
func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	if h.ragService == nil {
		writeError(w, http.StatusServiceUnavailable, "semantic search not available (no API key configured)")
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		writeError(w, http.StatusBadRequest, "q parameter is required")
		return
	}

	limit := 5
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	workbookID := r.URL.Query().Get("workbook_id")

	results, err := h.ragService.Search(r.Context(), query, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Filter by workbook if requested
	if workbookID != "" {
		filtered := results[:0]
		for _, res := range results {
			if res.WorkbookID == workbookID {
				filtered = append(filtered, res)
			}
		}
		results = filtered
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"results": results,
		"count":   len(results),
		"query":   query,
	})
}
