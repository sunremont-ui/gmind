package mcp

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/gmind/backend/internal/wiki"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir, err := os.MkdirTemp("", "mcp-wiki-test-*")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { os.RemoveAll(dir) })
	ws, err := wiki.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	ws.Write("hello", "# Hello Page\n\nThis is the hello page.")
	ws.Write("features", "# Features\n\nList of features.")
	return NewServer(ws, nil)
}

func newRequest(t *testing.T, method string, params any) json.RawMessage {
	t.Helper()
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  method,
	}
	if params != nil {
		data, _ := json.Marshal(params)
		req.Params = data
	}
	data, _ := json.Marshal(req)
	return data
}

func parseResponse(t *testing.T, raw json.RawMessage) JSONRPCResponse {
	t.Helper()
	var resp JSONRPCResponse
	if err := json.Unmarshal(raw, &resp); err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestInitialize(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "initialize", nil)
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error != nil {
		t.Fatalf("unexpected error: %v", resp.Error)
	}
	if resp.Result == nil {
		t.Fatal("expected result")
	}

	var initResult InitializeResult
	data, _ := json.Marshal(resp.Result)
	json.Unmarshal(data, &initResult)
	if initResult.ProtocolVersion != ProtocolVersion {
		t.Fatalf("expected protocol %s, got %s", ProtocolVersion, initResult.ProtocolVersion)
	}
	if initResult.ServerInfo.Name != "gmind-mcp" {
		t.Fatalf("expected gmind-mcp, got %s", initResult.ServerInfo.Name)
	}
	if initResult.Capabilities.Tools == nil {
		t.Fatal("expected tools capability")
	}
}

func TestToolsList(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "tools/list", nil)
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error != nil {
		t.Fatalf("unexpected error: %v", resp.Error)
	}

	result := resp.Result.(map[string]any)
	tools := result["tools"].([]any)
	if len(tools) != 9 {
		t.Fatalf("expected 9 tools, got %d", len(tools))
	}
}

func TestToolCallWikiSearch(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "tools/call", map[string]any{
		"name": "wiki_search",
		"arguments": map[string]any{
			"query": "hello",
		},
	})
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error != nil {
		t.Fatalf("unexpected error: %v", resp.Error)
	}

	result := resp.Result.(map[string]any)
	content := result["content"].([]any)
	if len(content) == 0 {
		t.Fatal("expected search results")
	}
}

func TestToolCallWikiRead(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "tools/call", map[string]any{
		"name": "wiki_read",
		"arguments": map[string]any{
			"slug": "hello",
		},
	})
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error != nil {
		t.Fatalf("unexpected error: %v", resp.Error)
	}

	result := resp.Result.(map[string]any)
	content := result["content"].([]any)
	if len(content) == 0 {
		t.Fatal("expected content")
	}
}

func TestToolCallWikiReadNotFound(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "tools/call", map[string]any{
		"name": "wiki_read",
		"arguments": map[string]any{
			"slug": "nonexistent",
		},
	})
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error != nil {
		t.Fatalf("unexpected error: %v", resp.Error)
	}

	result := resp.Result.(map[string]any)
	isError, _ := result["isError"].(bool)
	if !isError {
		t.Fatal("expected isError for nonexistent page")
	}
}

func TestToolCallWikiWrite(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "tools/call", map[string]any{
		"name": "wiki_write",
		"arguments": map[string]any{
			"slug":    "new-page",
			"content": "# New Page\n\nCreated via MCP.",
		},
	})
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error != nil {
		t.Fatalf("unexpected error: %v", resp.Error)
	}

	result := resp.Result.(map[string]any)
	content := result["content"].([]any)
	if len(content) == 0 {
		t.Fatal("expected result content")
	}
}

func TestInvalidJSONRPC(t *testing.T) {
	s := newTestServer(t)
	resp := parseResponse(t, s.Handle(json.RawMessage(`invalid`)))
	if resp.Error == nil {
		t.Fatal("expected parse error")
	}
	if resp.Error.Code != -32700 {
		t.Fatalf("expected code -32700, got %d", resp.Error.Code)
	}
}

func TestUnknownMethod(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "unknown_method", nil)
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error == nil {
		t.Fatal("expected method not found error")
	}
	if resp.Error.Code != -32601 {
		t.Fatalf("expected code -32601, got %d", resp.Error.Code)
	}
}

func TestUnknownTool(t *testing.T) {
	s := newTestServer(t)
	raw := newRequest(t, "tools/call", map[string]any{
		"name": "nonexistent_tool",
	})
	resp := parseResponse(t, s.Handle(raw))
	if resp.Error == nil {
		t.Fatal("expected error for unknown tool")
	}
}
