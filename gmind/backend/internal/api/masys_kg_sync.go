package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
)

// V6.0 Phase 3 — Knowledge Graph sync from MASys into Gmind.
//
// Reads MASys memory.graph.get(namespace) → { nodes, edges } and:
//   - Creates a new Gmind workbook (or reuses one by ID)
//   - For each node creates a child topic under the root
//   - For each edge creates a V5.0 relationship (using existing relationships table)
//
// Mapping is built in-memory: name → topic_id. The MASys graph identifies edges
// by sourceName/targetName (per addRelation input shape) so we match by name.

// MASysKGGraphResponse — proxy response shape from MASys memory.graph.get.
type MASysKGNode struct {
	Name        string                 `json:"name"`
	Type        string                 `json:"type"`
	Description string                 `json:"description,omitempty"`
	Attributes  map[string]interface{} `json:"attributes,omitempty"`
	Mentions    int                    `json:"mentions,omitempty"`
}

type MASysKGEdge struct {
	SourceName string `json:"sourceName"`
	TargetName string `json:"targetName"`
	Predicate  string `json:"predicate"`
}

type MASysKGGraphResponse struct {
	Nodes []MASysKGNode `json:"nodes"`
	Edges []MASysKGEdge `json:"edges"`
}

// MASysGetGraph — GET /api/v1/masys/memory/graph?namespace=...&limit=...
func (h *Handler) MASysGetGraph(w http.ResponseWriter, r *http.Request) {
	input := map[string]any{}
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		input["namespace"] = ns
	}
	if lim := r.URL.Query().Get("limit"); lim != "" {
		input["limit"] = lim
	}
	data, err := h.callTRPCQuery(r.Context(), "memory.graph.get", input)
	h.writeMASysJSON(w, data, err)
}

// KGSyncRequest — body for POST /api/v1/masys/kg-sync
type KGSyncRequest struct {
	Namespace     string `json:"namespace"`
	WorkbookTitle string `json:"workbook_title,omitempty"` // default: "MASys KG: <ns>"
	WorkbookID    string `json:"workbook_id,omitempty"`    // reuse existing if set
	Limit         int    `json:"limit,omitempty"`          // limit nodes to fetch
}

// KGSyncResponse — created/updated workbook id + counts + entity-to-topic mapping.
type KGSyncResponse struct {
	WorkbookID           string            `json:"workbook_id"`
	SheetID              string            `json:"sheet_id"`
	TopicsCreated        int               `json:"topics_created"`
	RelationshipsCreated int               `json:"relationships_created"`
	NodesTotal           int               `json:"nodes_total"`
	EdgesTotal           int               `json:"edges_total"`
	Mapping              map[string]string `json:"mapping"` // entity name → gmind topic id
}

// mapPredicateToType — heuristic mapping of MASys predicates to V5.0 relationship types.
func mapPredicateToType(predicate string) string {
	p := strings.ToLower(strings.TrimSpace(predicate))
	switch {
	case strings.Contains(p, "depends") || strings.Contains(p, "requires"):
		return "depends_on"
	case strings.Contains(p, "support") || strings.Contains(p, "confirms"):
		return "supports"
	case strings.Contains(p, "contradicts") || strings.Contains(p, "conflicts"):
		return "contradicts"
	case strings.Contains(p, "references") || strings.Contains(p, "cites"):
		return "references"
	case strings.Contains(p, "blocks") || strings.Contains(p, "prevents"):
		return "blocks"
	default:
		return "relates_to"
	}
}

// MASysKGSync — POST /api/v1/masys/kg-sync
// Body: KGSyncRequest. Creates/updates a workbook with MASys graph data.
func (h *Handler) MASysKGSync(w http.ResponseWriter, r *http.Request) {
	if h.relationships == nil {
		writeError(w, http.StatusServiceUnavailable, "relationships store not initialized")
		return
	}
	if h.store == nil {
		writeError(w, http.StatusServiceUnavailable, "store not initialized")
		return
	}
	var req KGSyncRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.Namespace == "" {
		req.Namespace = "default"
	}
	if req.WorkbookTitle == "" {
		req.WorkbookTitle = fmt.Sprintf("MASys KG: %s", req.Namespace)
	}

	// 1. Fetch graph from MASys
	input := map[string]any{"namespace": req.Namespace}
	if req.Limit > 0 {
		input["limit"] = req.Limit
	}
	raw, err := h.callTRPCQuery(r.Context(), "memory.graph.get", input)
	if err != nil {
		writeError(w, http.StatusBadGateway, "MASys graph fetch: "+err.Error())
		return
	}
	var graph MASysKGGraphResponse
	if err := json.Unmarshal(raw, &graph); err != nil {
		writeError(w, http.StatusBadGateway, "decode MASys graph: "+err.Error())
		return
	}

	// 2. Get or create workbook
	var wb *model.Workbook
	if req.WorkbookID != "" {
		existing, err := h.store.GetWorkbook(req.WorkbookID)
		if err != nil {
			internalError(w, err)
			return
		}
		if existing == nil {
			writeError(w, http.StatusNotFound, "workbook not found")
			return
		}
		wb = existing
	} else {
		wb = model.NewWorkbook(req.WorkbookTitle)
		sheet := model.NewSheet(req.WorkbookTitle)
		wb.AddSheet(sheet)
		if err := h.store.CreateWorkbook(wb); err != nil {
			internalError(w, err)
			return
		}
	}

	if len(wb.Sheets) == 0 {
		writeError(w, http.StatusInternalServerError, "workbook has no sheets")
		return
	}
	// Syncing a knowledge graph into a workbook makes it a memory-lab canvas.
	if wb.Kind == "" {
		wb.Kind = "memory_lab"
	}
	sheet := wb.Sheets[0]
	root := sheet.RootTopic

	// 3. Build mapping name → topic_id. Identity is by stable MasysRef.Key so a
	// re-sync after a node was renamed in Gmind does not create a duplicate.
	// Topics without a ref (legacy / hand-made) are still matched by title.
	mapping := map[string]string{}
	existingByRef := map[string]string{}
	existingByTitle := map[string]string{}
	walkTopics(root, func(t *model.Topic) {
		if t.MasysRef != nil && t.MasysRef.Namespace == req.Namespace {
			existingByRef[t.MasysRef.Key] = t.ID
		}
		if _, ok := existingByTitle[t.Title]; !ok {
			existingByTitle[t.Title] = t.ID
		}
	})

	topicsCreated := 0
	for _, node := range graph.Nodes {
		if node.Name == "" {
			continue
		}
		if id, ok := existingByRef[node.Name]; ok {
			mapping[node.Name] = id
			continue
		}
		if id, ok := existingByTitle[node.Name]; ok {
			mapping[node.Name] = id
			continue
		}
		t := model.NewTopic(node.Name)
		if node.Description != "" {
			t.Notes = node.Description
		}
		// Stamp type in labels for visibility …
		if node.Type != "" {
			t.Labels = append(t.Labels, node.Type)
		}
		// … and structurally as the memory kind + stable external ref.
		t.MemoryKind = node.Type
		t.MasysRef = &model.MasysRef{Namespace: req.Namespace, Kind: node.Type, Key: node.Name}
		root.AddChild(t)
		mapping[node.Name] = t.ID
		existingByRef[node.Name] = t.ID
		existingByTitle[node.Name] = t.ID
		topicsCreated++
	}

	// 4. Save workbook (topic creation goes through full-document save)
	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	// 5. Create relationships from edges (idempotent via FindBetween + type check)
	relsCreated := 0
	for _, edge := range graph.Edges {
		fromID := mapping[edge.SourceName]
		toID := mapping[edge.TargetName]
		if fromID == "" || toID == "" {
			continue
		}
		relType := mapPredicateToType(edge.Predicate)
		// Skip if an edge of the same type already exists between this pair.
		existing, err := h.relationships.FindBetween(fromID, toID)
		if err == nil {
			alreadyHas := false
			for _, e := range existing {
				if e.Type == relType {
					alreadyHas = true
					break
				}
			}
			if alreadyHas {
				continue
			}
		}
		rec := &store.RelationshipRecord{
			WorkbookID:  wb.ID,
			FromTopicID: fromID,
			ToTopicID:   toID,
			Type:        relType,
			Direction:   "forward",
			Title:       edge.Predicate,
			CreatedBy:   "masys-sync",
		}
		if err := h.relationships.Insert(rec); err == nil {
			relsCreated++
		}
	}

	resp := KGSyncResponse{
		WorkbookID:           wb.ID,
		SheetID:              sheet.ID,
		TopicsCreated:        topicsCreated,
		RelationshipsCreated: relsCreated,
		NodesTotal:           len(graph.Nodes),
		EdgesTotal:           len(graph.Edges),
		Mapping:              mapping,
	}
	writeJSON(w, http.StatusOK, resp)
}

func walkTopics(t *model.Topic, fn func(*model.Topic)) {
	if t == nil {
		return
	}
	fn(t)
	for _, c := range t.Children {
		walkTopics(c, fn)
	}
}
