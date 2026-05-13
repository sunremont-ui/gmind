package agent

import "encoding/json"

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

// Global tool registry.
var ToolRegistry = []ToolDef{
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
}

// GetToolsForRole returns tools available to a given role.
func GetToolsForRole(role string) []ToolDef {
	switch role {
	case "researcher":
		return filterTools("mindmap", "search", "wiki")
	case "organizer":
		return filterTools("mindmap")
	case "critic":
		return filterTools("mindmap", "analysis")
	case "expander":
		return filterTools("mindmap")
	case "summarizer":
		return filterTools("mindmap", "analysis")
	case "editor":
		return filterTools("mindmap")
	case "analyst":
		return filterTools("mindmap", "analysis")
	case "writer":
		return filterTools("mindmap", "wiki")
	default:
		return ToolRegistry
	}
}

func filterTools(categories ...string) []ToolDef {
	set := make(map[string]bool)
	for _, c := range categories {
		set[c] = true
	}
	var result []ToolDef
	for _, t := range ToolRegistry {
		if set[t.Category] {
			result = append(result, t)
		}
	}
	return result
}
