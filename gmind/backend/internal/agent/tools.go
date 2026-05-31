package agent

import (
	"encoding/json"
	"sync"
)

// ToolDef describes a tool available to an agent.
type ToolDef struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Schema      json.RawMessage `json:"input_schema"` // JSON Schema
	Category    string          `json:"category,omitempty"`
	Idempotent  bool            `json:"idempotent,omitempty"`
}

// ToolResult is returned after executing a tool call.
type ToolResult struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   string          `json:"error,omitempty"`
}

var (
	toolRegistryMu sync.RWMutex
	toolRegistry   []ToolDef
)

// RegisterTool adds a tool to the global registry. Thread-safe; can be called at init time.
func RegisterTool(t ToolDef) {
	toolRegistryMu.Lock()
	defer toolRegistryMu.Unlock()
	toolRegistry = append(toolRegistry, t)
}

// GetRegistry returns a snapshot of the current tool registry.
func GetRegistry() []ToolDef {
	toolRegistryMu.RLock()
	defer toolRegistryMu.RUnlock()
	result := make([]ToolDef, len(toolRegistry))
	copy(result, toolRegistry)
	return result
}

// ToolRegistry is kept for backward compatibility.
// Prefer GetRegistry() in new code.
var ToolRegistry []ToolDef

func init() {
	toolRegistry = []ToolDef{
	{
		Name:        "create_topic",
		Description: "Creates a new topic as a child of a parent topic in the mind map",
		Schema:      json.RawMessage(`{"type":"object","properties":{"parent_id":{"type":"string","description":"ID of the parent topic"},"title":{"type":"string","description":"Title of the new topic"},"position":{"type":"object","properties":{"x":{"type":"number"},"y":{"type":"number"}},"nullable":true}},"required":["parent_id","title"]}`),
		Category:    "mindmap",
		Idempotent:  false,
	},
	{
		Name:        "update_topic",
		Description: "Updates the title or notes of an existing topic",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topic_id":{"type":"string","description":"ID of the topic to update"},"title":{"type":"string","description":"New title","nullable":true},"notes":{"type":"string","description":"New notes content","nullable":true}},"required":["topic_id"]}`),
		Category:    "mindmap",
		Idempotent:  true,
	},
	{
		Name:        "create_multiple_topics",
		Description: "Creates multiple child topics under one parent in a single call. Use this for batch subtopic generation.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"parent_id":{"type":"string","description":"ID of the parent topic"},"titles":{"type":"array","items":{"type":"string"},"description":"List of topic titles to create"}},"required":["parent_id","titles"]}`),
		Category:    "mindmap",
		Idempotent:  false,
	},
	{
		Name:        "wiki_search",
		Description: "Searches the wiki for pages matching a query. Returns page slugs, titles, and snippets.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"max_results":{"type":"integer","description":"Max results to return","default":5}},"required":["query"]}`),
		Category:    "wiki",
		Idempotent:  true,
	},
	{
		Name:        "wiki_read",
		Description: "Reads the full content of a wiki page by slug.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"slug":{"type":"string","description":"Page slug (filename without .md)"}},"required":["slug"]}`),
		Category:    "wiki",
		Idempotent:  true,
	},
	{
		Name:        "wiki_write",
		Description: "Creates or updates a wiki page. If the slug exists, it will be overwritten.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"slug":{"type":"string","description":"Page slug (filename without .md)"},"content":{"type":"string","description":"Full markdown content"}},"required":["slug","content"]}`),
		Category:    "wiki",
		Idempotent:  false,
	},
	{
		Name:        "search_web",
		Description: "Searches the web for information on a query. Returns a summary of relevant results.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query"},"max_results":{"type":"integer","description":"Max results to return (1-10)","default":5}},"required":["query"]}`),
		Category:    "search",
		Idempotent:  true,
	},
	{
		Name:        "add_note",
		Description: "Adds or replaces the notes/description of a topic",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topic_id":{"type":"string","description":"ID of the topic"},"notes":{"type":"string","description":"Note content to add"}},"required":["topic_id","notes"]}`),
		Category:    "mindmap",
		Idempotent:  true,
	},
	{
		Name:        "get_topic",
		Description: "Gets the full details of a topic including its children",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topic_id":{"type":"string","description":"ID of the topic to retrieve"}},"required":["topic_id"]}`),
		Category:    "mindmap",
		Idempotent:  true,
	},
	{
		Name:        "get_workbook",
		Description: "Gets the entire workbook structure including all sheets and topics",
		Schema:      json.RawMessage(`{"type":"object","properties":{"workbook_id":{"type":"string","description":"ID of the workbook"}},"required":["workbook_id"]}`),
		Category:    "mindmap",
		Idempotent:  true,
	},
	{
		Name:        "summarize_topics",
		Description: "Summarizes a list of topic titles into a concise bullet-point summary",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topics":{"type":"array","items":{"type":"string"},"description":"Topic titles to summarize"},"max_points":{"type":"integer","description":"Maximum bullet points","default":5}},"required":["topics"]}`),
		Category:    "analysis",
		Idempotent:  true,
	},
	{
		Name:        "run_masys_pipeline",
		Description: "Runs a MASys pipeline by ID with the given JSON inputs. Returns the pipeline run result. Use this to delegate complex workflows to MASys.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"pipeline_id":{"type":"string","description":"MASys pipeline ID to run"},"inputs":{"type":"object","description":"Pipeline input parameters as key-value pairs"}},"required":["pipeline_id"]}`),
		Category:    "masys",
		Idempotent:  false,
	},
	{
		Name:        "delete_topic",
		Description: "Deletes a topic and all its children from the mind map. Cannot delete the root topic.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topic_id":{"type":"string","description":"ID of the topic to delete"}},"required":["topic_id"]}`),
		Category:    "mindmap",
		Idempotent:  false,
	},
	{
		Name:        "move_topic",
		Description: "Moves a topic to a new parent topic, preserving all its children. Cannot move the root topic.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topic_id":{"type":"string","description":"ID of the topic to move"},"new_parent_id":{"type":"string","description":"ID of the new parent topic"}},"required":["topic_id","new_parent_id"]}`),
		Category:    "mindmap",
		Idempotent:  false,
	},
	{
		Name:        "list_topics",
		Description: "Returns a flat list of all topics in the current sheet with their IDs, titles, parent IDs, and depth. Use this to navigate the mind map structure before modifying it.",
		Schema:      json.RawMessage(`{"type":"object","properties":{}}`),
		Category:    "mindmap",
		Idempotent:  true,
	},
	{
		Name:        "delegate_to_agent",
		Description: "Delegates a task to another agent and waits synchronously for its result. Use this to coordinate multi-agent workflows. Cannot delegate to self.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"agent_id":{"type":"string","description":"ID of the target agent"},"action":{"type":"string","description":"Task instruction for the target agent"},"params":{"type":"object","description":"Additional task parameters"}},"required":["agent_id","action"]}`),
		Category:    "agent",
		Idempotent:  false,
	},
	{
		Name:        "parallel_delegate",
		Description: "Delegates multiple tasks to different agents in parallel (fan-out) and waits for all to complete. Returns array of results in the same order. Use for independent sub-tasks that can run concurrently.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"tasks":{"type":"array","description":"List of tasks to delegate in parallel","items":{"type":"object","properties":{"agent_id":{"type":"string","description":"ID of the target agent"},"action":{"type":"string","description":"Task instruction"},"params":{"type":"object","description":"Additional parameters"}},"required":["agent_id","action"]}}},"required":["tasks"]}`),
		Category:    "agent",
		Idempotent:  false,
	},
	{
		Name:        "list_agents",
		Description: "Returns the list of available agents with their IDs, names, roles, and current status. Use this before delegate_to_agent or parallel_delegate to discover what agents are available.",
		Schema:      json.RawMessage(`{"type":"object","properties":{}}`),
		Category:    "agent",
		Idempotent:  true,
	},
	{
		Name:        "save_note",
		Description: "Saves a quick note with optional tags and workbook association. Use this to persist insights, summaries, or observations.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"content":{"type":"string","description":"Note content"},"tags":{"type":"array","items":{"type":"string"},"description":"Optional tags"},"workbook_id":{"type":"string","description":"Optional workbook to associate with"}},"required":["content"]}`),
		Category:    "notes",
		Idempotent:  false,
	},
	{
		Name:        "search_notes",
		Description: "Searches saved notes by content or tags. Returns matching notes.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Search query matching note content or tags"}},"required":["query"]}`),
		Category:    "notes",
		Idempotent:  true,
	},
	{
		Name:        "create_relationship",
		Description: "Creates a typed, directional relationship (edge) between two topics. Supports types: relates_to, depends_on, supports, contradicts, references, blocks, custom. Direction: forward|bidirectional|undirected. Multi-edge allowed.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"from_topic_id":{"type":"string"},"to_topic_id":{"type":"string"},"type":{"type":"string","default":"relates_to"},"direction":{"type":"string","default":"forward"},"title":{"type":"string"},"weight":{"type":"number"},"notes":{"type":"string"},"workbook_id":{"type":"string","description":"Override workbook for cross-workbook edges"}},"required":["from_topic_id","to_topic_id"]}`),
		Category:    "graph",
		Idempotent:  false,
	},
	{
		Name:        "list_relationships",
		Description: "Lists relationships of a topic (both incoming and outgoing). Optionally filter by type or direction.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topic_id":{"type":"string"},"type":{"type":"string"},"direction":{"type":"string"}},"required":["topic_id"]}`),
		Category:    "graph",
		Idempotent:  true,
	},
	{
		Name:        "get_related_topics",
		Description: "BFS-traverses the relationship graph from a starting topic, returning visited topic IDs and traversed edges. Use for graph context, agent memory, building subgraphs.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"topic_id":{"type":"string"},"depth":{"type":"integer","default":2,"description":"BFS depth (1-5)"},"types":{"type":"array","items":{"type":"string"},"description":"Filter by these edge types"}},"required":["topic_id"]}`),
		Category:    "graph",
		Idempotent:  true,
	},
	{
		Name:        "detect_cycles",
		Description: "Detects directional cycles in the dependency graph of a workbook. Useful for finding contradictions or circular dependencies.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"workbook_id":{"type":"string"},"type":{"type":"string","description":"Filter cycles by edge type (e.g. 'depends_on')"}},"required":["workbook_id"]}`),
		Category:    "graph",
		Idempotent:  true,
	},
	{
		Name:        "update_relationship",
		Description: "Updates an existing relationship's type, direction, title, weight, notes, color, or style.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"relationship_id":{"type":"string"},"type":{"type":"string"},"direction":{"type":"string"},"title":{"type":"string"},"weight":{"type":"number"},"notes":{"type":"string"},"color":{"type":"string"},"style":{"type":"string"}},"required":["relationship_id"]}`),
		Category:    "graph",
		Idempotent:  true,
	},
	{
		Name:        "delete_relationship",
		Description: "Deletes a relationship by ID.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"relationship_id":{"type":"string"}},"required":["relationship_id"]}`),
		Category:    "graph",
		Idempotent:  false,
	},
	{
		Name:        "semantic_search",
		Description: "Searches all mindmap topics semantically using vector embeddings. Returns the most relevant topics across all workbooks. Requires OpenAI API key for embedding generation.",
		Schema:      json.RawMessage(`{"type":"object","properties":{"query":{"type":"string","description":"Natural language search query"},"limit":{"type":"integer","description":"Max results to return","default":5},"workbook_id":{"type":"string","description":"Optional: limit search to a specific workbook"}},"required":["query"]}`),
		Category:    "search",
		Idempotent:  true,
	},
	}

	// Sync ToolRegistry for backward compatibility
	ToolRegistry = GetRegistry()
}

// GetToolsForRole returns tools available to a given role.
func GetToolsForRole(role string) []ToolDef {
	switch role {
	case "researcher":
		return filterTools("mindmap", "search", "wiki", "masys", "agent", "notes", "graph")
	case "organizer":
		return filterTools("mindmap", "masys", "agent", "notes", "graph")
	case "critic":
		return filterTools("mindmap", "analysis", "graph")
	case "expander":
		return filterTools("mindmap", "graph")
	case "summarizer":
		return filterTools("mindmap", "analysis", "search", "notes", "graph")
	case "editor":
		return filterTools("mindmap", "graph")
	case "analyst":
		return filterTools("mindmap", "analysis", "search", "masys", "agent", "notes", "graph")
	case "writer":
		return filterTools("mindmap", "wiki", "search", "notes", "graph")
	case "supervisor":
		// Orchestrator role: delegates to other agents, can fan-out, sees notes/wiki/graph for context
		return filterTools("agent", "notes", "wiki", "search", "analysis", "graph")
	default:
		return GetRegistry()
	}
}

func filterTools(categories ...string) []ToolDef {
	set := make(map[string]bool)
	for _, c := range categories {
		set[c] = true
	}
	var result []ToolDef
	for _, t := range GetRegistry() {
		if set[t.Category] {
			result = append(result, t)
		}
	}
	return result
}
