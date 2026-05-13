package mcp

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/wiki"
)

const ProtocolVersion = "2025-03-26"

type ServerCapabilities struct {
	Tools  *ToolCapabilities  `json:"tools,omitempty"`
	Resources *ResourceCapabilities `json:"resources,omitempty"`
}

type ToolCapabilities struct {
	ListChanged bool `json:"listChanged"`
}

type ResourceCapabilities struct {
	ListChanged bool `json:"listChanged"`
}

type ServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

// JSON-RPC types
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

// MCP Tool types
type ToolInputSchema struct {
	Type       string                    `json:"type"`
	Properties map[string]ToolProperty   `json:"properties"`
	Required   []string                  `json:"required,omitempty"`
}

type ToolProperty struct {
	Type        string `json:"type"`
	Description string `json:"description"`
}

type Tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema ToolInputSchema `json:"inputSchema"`
}

type CallToolResult struct {
	Content []ToolContent `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

type ToolContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Initialize result
type InitializeResult struct {
	ProtocolVersion string             `json:"protocolVersion"`
	Capabilities    ServerCapabilities `json:"capabilities"`
	ServerInfo      ServerInfo         `json:"serverInfo"`
}

type Server struct {
	mu        sync.RWMutex
	wikiStore *wiki.Store
	mindStore *store.Store
	tools     []Tool
}

func NewServer(wikiStore *wiki.Store, mindStore *store.Store) *Server {
	s := &Server{
		wikiStore: wikiStore,
		mindStore: mindStore,
		tools:     defaultTools(),
	}
	return s
}

func defaultTools() []Tool {
	return []Tool{
		{
			Name:        "mindmap_create_workbook",
			Description: "Create a new mind map workbook. Returns workbook ID, root topic ID, and sheet ID.",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"title": {Type: "string", Description: "Title of the mind map"},
				},
				Required: []string{"title"},
			},
		},
		{
			Name:        "mindmap_get_workbook",
			Description: "Get the full topic tree of a workbook as JSON. Returns the complete structure including all sheets and nested topics.",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"workbook_id": {Type: "string", Description: "Workbook ID"},
				},
				Required: []string{"workbook_id"},
			},
		},
		{
			Name:        "mindmap_list_workbooks",
			Description: "List all available workbooks with their IDs and titles.",
			InputSchema: ToolInputSchema{
				Type:       "object",
				Properties: map[string]ToolProperty{},
			},
		},
		{
			Name:        "mindmap_create_topic",
			Description: "Create a new topic inside a workbook under a parent topic. Supports styling: font_color, font_size, node_width, border_color, shape, icon.",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"workbook_id": {Type: "string", Description: "Workbook ID"},
					"parent_id":   {Type: "string", Description: "Parent topic ID"},
					"title":       {Type: "string", Description: "Topic title"},
					"notes":       {Type: "string", Description: "Optional notes/description"},
					"font_color":  {Type: "string", Description: "Font color e.g. #ff0000"},
					"shape":       {Type: "string", Description: "Node shape: rect, rounded, ellipse, diamond"},
					"icon":        {Type: "string", Description: "Icon name"},
				},
				Required: []string{"workbook_id", "parent_id", "title"},
			},
		},
		{
			Name:        "mindmap_update_topic",
			Description: "Update an existing topic's title, notes, or styling.",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"workbook_id": {Type: "string", Description: "Workbook ID"},
					"topic_id":    {Type: "string", Description: "Topic ID to update"},
					"title":       {Type: "string", Description: "New title (optional)"},
					"notes":       {Type: "string", Description: "New notes (optional)"},
					"font_color":  {Type: "string", Description: "Font color (optional)"},
					"shape":       {Type: "string", Description: "Node shape (optional)"},
					"icon":        {Type: "string", Description: "Icon name (optional)"},
				},
				Required: []string{"workbook_id", "topic_id"},
			},
		},
		{
			Name:        "mindmap_delete_topic",
			Description: "Delete a topic and all its children from a workbook.",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"workbook_id": {Type: "string", Description: "Workbook ID"},
					"topic_id":    {Type: "string", Description: "Topic ID to delete"},
				},
				Required: []string{"workbook_id", "topic_id"},
			},
		},
		{
			Name:        "wiki_search",
			Description: "Search the wiki for pages matching a query",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"query":       {Type: "string", Description: "Search query"},
					"max_results": {Type: "integer", Description: "Max results (default 5)"},
				},
				Required: []string{"query"},
			},
		},
		{
			Name:        "wiki_read",
			Description: "Read the full content of a wiki page by slug",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"slug": {Type: "string", Description: "Page slug (filename without .md)"},
				},
				Required: []string{"slug"},
			},
		},
		{
			Name:        "wiki_write",
			Description: "Create or update a wiki page",
			InputSchema: ToolInputSchema{
				Type: "object",
				Properties: map[string]ToolProperty{
					"slug":    {Type: "string", Description: "Page slug"},
					"content": {Type: "string", Description: "Full markdown content"},
				},
				Required: []string{"slug", "content"},
			},
		},
	}
}

func (s *Server) Handle(raw json.RawMessage) json.RawMessage {
	var req JSONRPCRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return s.error(nil, -32700, "Parse error")
	}
	if req.JSONRPC != "2.0" {
		return s.error(req.ID, -32600, "Invalid Request: jsonrpc must be 2.0")
	}

	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "tools/list":
		return s.handleToolsList(req)
	case "tools/call":
		return s.handleToolsCall(req)
	default:
		return s.error(req.ID, -32601, fmt.Sprintf("Method not found: %s", req.Method))
	}
}

func (s *Server) handleInitialize(req JSONRPCRequest) json.RawMessage {
	result := InitializeResult{
		ProtocolVersion: ProtocolVersion,
		Capabilities: ServerCapabilities{
			Tools: &ToolCapabilities{ListChanged: false},
		},
		ServerInfo: ServerInfo{
			Name:    "gmind-mcp",
			Version: "0.1.0",
		},
	}
	return s.result(req.ID, result)
}

func (s *Server) handleToolsList(req JSONRPCRequest) json.RawMessage {
	s.mu.RLock()
	tools := s.tools
	s.mu.RUnlock()
	return s.result(req.ID, map[string]any{"tools": tools})
}

func (s *Server) handleToolsCall(req JSONRPCRequest) json.RawMessage {
	var params struct {
		Name      string          `json:"name"`
		Arguments json.RawMessage `json:"arguments"`
	}
	if err := json.Unmarshal(req.Params, &params); err != nil {
		return s.error(req.ID, -32602, "Invalid params")
	}

	var result CallToolResult
	switch params.Name {
	case "wiki_search":
		result = s.callWikiSearch(params.Arguments)
	case "wiki_read":
		result = s.callWikiRead(params.Arguments)
	case "wiki_write":
		result = s.callWikiWrite(params.Arguments)
	case "mindmap_create_workbook":
		result = s.callMindmapCreateWorkbook(params.Arguments)
	case "mindmap_get_workbook":
		result = s.callMindmapGetWorkbook(params.Arguments)
	case "mindmap_list_workbooks":
		result = s.callMindmapListWorkbooks(params.Arguments)
	case "mindmap_create_topic":
		result = s.callMindmapCreateTopic(params.Arguments)
	case "mindmap_update_topic":
		result = s.callMindmapUpdateTopic(params.Arguments)
	case "mindmap_delete_topic":
		result = s.callMindmapDeleteTopic(params.Arguments)
	default:
		return s.error(req.ID, -32601, fmt.Sprintf("Tool not found: %s", params.Name))
	}

	return s.result(req.ID, result)
}

func (s *Server) callWikiSearch(raw json.RawMessage) CallToolResult {
	var args struct {
		Query      string `json:"query"`
		MaxResults int    `json:"max_results"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}},
		}
	}
	if s.wikiStore == nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: "Wiki module not available"}},
		}
	}
	if args.MaxResults <= 0 {
		args.MaxResults = 5
	}
	results, err := s.wikiStore.Search(args.Query, args.MaxResults)
	if err != nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Search failed: %v", err)}},
		}
	}
	data, _ := json.MarshalIndent(results, "", "  ")
	return CallToolResult{
		Content: []ToolContent{{Type: "text", Text: string(data)}},
	}
}

func (s *Server) callWikiRead(raw json.RawMessage) CallToolResult {
	var args struct {
		Slug string `json:"slug"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}},
		}
	}
	if s.wikiStore == nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: "Wiki module not available"}},
		}
	}
	page, err := s.wikiStore.Read(args.Slug)
	if err != nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Read failed: %v", err)}},
		}
	}
	return CallToolResult{
		Content: []ToolContent{{Type: "text", Text: page.Content}},
	}
}

func (s *Server) callWikiWrite(raw json.RawMessage) CallToolResult {
	var args struct {
		Slug    string `json:"slug"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}},
		}
	}
	if s.wikiStore == nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: "Wiki module not available"}},
		}
	}
	page, err := s.wikiStore.Write(args.Slug, args.Content)
	if err != nil {
		return CallToolResult{
			IsError: true,
			Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Write failed: %v", err)}},
		}
	}
	return CallToolResult{
		Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Written: %s (%s)", page.Slug, page.Title)}},
	}
}

// ---------------------------------------------------------------------------
// Mindmap tool implementations
// ---------------------------------------------------------------------------

func (s *Server) mindStoreErr() CallToolResult {
	return CallToolResult{
		IsError: true,
		Content: []ToolContent{{Type: "text", Text: "Mind map store not available"}},
	}
}

func (s *Server) callMindmapCreateWorkbook(raw json.RawMessage) CallToolResult {
	if s.mindStore == nil {
		return s.mindStoreErr()
	}
	var args struct {
		Title string `json:"title"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}}}
	}
	if args.Title == "" {
		args.Title = "Untitled Mind Map"
	}
	wb := model.NewWorkbook(args.Title)
	sheet := model.NewSheet("Central Topic")
	wb.AddSheet(sheet)
	if err := s.mindStore.CreateWorkbook(wb); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Create failed: %v", err)}}}
	}
	rootID := ""
	sheetID := ""
	if len(wb.Sheets) > 0 {
		sheetID = wb.Sheets[0].ID
		if wb.Sheets[0].RootTopic != nil {
			rootID = wb.Sheets[0].RootTopic.ID
		}
	}
	data, _ := json.Marshal(map[string]string{"id": wb.ID, "root_topic_id": rootID, "sheet_id": sheetID})
	return CallToolResult{Content: []ToolContent{{Type: "text", Text: string(data)}}}
}

func (s *Server) callMindmapGetWorkbook(raw json.RawMessage) CallToolResult {
	if s.mindStore == nil {
		return s.mindStoreErr()
	}
	var args struct {
		WorkbookID string `json:"workbook_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}}}
	}
	wb, err := s.mindStore.GetWorkbook(args.WorkbookID)
	if err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Get failed: %v", err)}}}
	}
	if wb == nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Workbook not found"}}}
	}
	data, _ := json.MarshalIndent(wb, "", "  ")
	return CallToolResult{Content: []ToolContent{{Type: "text", Text: string(data)}}}
}

func (s *Server) callMindmapListWorkbooks(_ json.RawMessage) CallToolResult {
	if s.mindStore == nil {
		return s.mindStoreErr()
	}
	workbooks, err := s.mindStore.ListWorkbooks()
	if err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("List failed: %v", err)}}}
	}
	type wbSummary struct {
		ID    string `json:"id"`
		Title string `json:"title"`
	}
	summaries := make([]wbSummary, 0, len(workbooks))
	for _, wb := range workbooks {
		summaries = append(summaries, wbSummary{ID: wb.ID, Title: wb.Title})
	}
	data, _ := json.MarshalIndent(summaries, "", "  ")
	return CallToolResult{Content: []ToolContent{{Type: "text", Text: string(data)}}}
}

func (s *Server) callMindmapCreateTopic(raw json.RawMessage) CallToolResult {
	if s.mindStore == nil {
		return s.mindStoreErr()
	}
	var args struct {
		WorkbookID string `json:"workbook_id"`
		ParentID   string `json:"parent_id"`
		Title      string `json:"title"`
		Notes      string `json:"notes"`
		FontColor  string `json:"font_color"`
		Shape      string `json:"shape"`
		Icon       string `json:"icon"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}}}
	}
	wb, err := s.mindStore.GetWorkbook(args.WorkbookID)
	if err != nil || wb == nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Workbook not found"}}}
	}
	topic := model.NewTopic(args.Title)
	if args.Notes != "" {
		topic.Notes = args.Notes
	}
	if args.FontColor != "" {
		topic.FontColor = args.FontColor
	}
	if args.Shape != "" {
		topic.Shape = args.Shape
	}
	if args.Icon != "" {
		topic.Icon = args.Icon
	}
	found := false
	for _, sheet := range wb.Sheets {
		parent := sheet.FindTopic(args.ParentID)
		if parent != nil {
			parent.AddChild(topic)
			found = true
			break
		}
	}
	if !found {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Parent topic not found"}}}
	}
	if err := s.mindStore.UpdateWorkbook(wb); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Update failed: %v", err)}}}
	}
	data, _ := json.Marshal(map[string]string{"id": topic.ID, "title": topic.Title})
	return CallToolResult{Content: []ToolContent{{Type: "text", Text: string(data)}}}
}

func (s *Server) callMindmapUpdateTopic(raw json.RawMessage) CallToolResult {
	if s.mindStore == nil {
		return s.mindStoreErr()
	}
	var args struct {
		WorkbookID string `json:"workbook_id"`
		TopicID    string `json:"topic_id"`
		Title      string `json:"title"`
		Notes      string `json:"notes"`
		FontColor  string `json:"font_color"`
		Shape      string `json:"shape"`
		Icon       string `json:"icon"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}}}
	}
	wb, err := s.mindStore.GetWorkbook(args.WorkbookID)
	if err != nil || wb == nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Workbook not found"}}}
	}
	found := false
	for _, sheet := range wb.Sheets {
		topic := sheet.FindTopic(args.TopicID)
		if topic != nil {
			if args.Title != "" {
				topic.Title = args.Title
			}
			if args.Notes != "" {
				topic.Notes = args.Notes
			}
			if args.FontColor != "" {
				topic.FontColor = args.FontColor
			}
			if args.Shape != "" {
				topic.Shape = args.Shape
			}
			if args.Icon != "" {
				topic.Icon = args.Icon
			}
			found = true
			break
		}
	}
	if !found {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Topic not found"}}}
	}
	if err := s.mindStore.UpdateWorkbook(wb); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Update failed: %v", err)}}}
	}
	return CallToolResult{Content: []ToolContent{{Type: "text", Text: `{"status":"updated"}`}}}
}

func (s *Server) callMindmapDeleteTopic(raw json.RawMessage) CallToolResult {
	if s.mindStore == nil {
		return s.mindStoreErr()
	}
	var args struct {
		WorkbookID string `json:"workbook_id"`
		TopicID    string `json:"topic_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Invalid arguments: %v", err)}}}
	}
	wb, err := s.mindStore.GetWorkbook(args.WorkbookID)
	if err != nil || wb == nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Workbook not found"}}}
	}
	for _, sheet := range wb.Sheets {
		if sheet.RootTopic != nil && sheet.RootTopic.ID == args.TopicID {
			return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Cannot delete root topic"}}}
		}
	}
	found := false
	for _, sheet := range wb.Sheets {
		if removeTopicFromTree(sheet.RootTopic, args.TopicID) {
			found = true
			break
		}
	}
	if !found {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: "Topic not found"}}}
	}
	if err := s.mindStore.UpdateWorkbook(wb); err != nil {
		return CallToolResult{IsError: true, Content: []ToolContent{{Type: "text", Text: fmt.Sprintf("Update failed: %v", err)}}}
	}
	return CallToolResult{Content: []ToolContent{{Type: "text", Text: `{"status":"deleted"}`}}}
}

func removeTopicFromTree(parent *model.Topic, id string) bool {
	if parent == nil {
		return false
	}
	for i, child := range parent.Children {
		if child.ID == id {
			parent.Children = append(parent.Children[:i], parent.Children[i+1:]...)
			return true
		}
		if removeTopicFromTree(child, id) {
			return true
		}
	}
	return false
}

func (s *Server) result(id json.RawMessage, result any) json.RawMessage {
	resp := JSONRPCResponse{JSONRPC: "2.0", ID: id, Result: result}
	data, _ := json.Marshal(resp)
	return data
}

func (s *Server) error(id json.RawMessage, code int, message string) json.RawMessage {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error:   &JSONRPCError{Code: code, Message: message},
	}
	data, _ := json.Marshal(resp)
	return data
}
