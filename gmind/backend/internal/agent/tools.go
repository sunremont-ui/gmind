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
		return filterTools("mindmap", "search", "wiki", "masys", "agent", "notes")
	case "organizer":
		return filterTools("mindmap", "masys", "agent", "notes")
	case "critic":
		return filterTools("mindmap", "analysis")
	case "expander":
		return filterTools("mindmap")
	case "summarizer":
		return filterTools("mindmap", "analysis", "search", "notes")
	case "editor":
		return filterTools("mindmap")
	case "analyst":
		return filterTools("mindmap", "analysis", "search", "masys", "agent", "notes")
	case "writer":
		return filterTools("mindmap", "wiki", "search", "notes")
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
