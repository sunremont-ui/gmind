package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// YandexGPTProvider implements LLMProvider using the native YandexGPT API.
type YandexGPTProvider struct {
	apiKey   string
	folderID string
	model    string
}

func NewYandexGPTProvider(apiKey, folderID, model string) *YandexGPTProvider {
	if model == "" {
		model = "yandexgpt"
	}
	return &YandexGPTProvider{
		apiKey:   apiKey,
		folderID: folderID,
		model:    model,
	}
}

type yandexMessage struct {
	Role string `json:"role"`
	Text string `json:"text"`
}

type yandexRequest struct {
	ModelURI          string                 `json:"modelUri"`
	CompletionOptions yandexOptions          `json:"completionOptions"`
	Messages          []yandexMessage        `json:"messages"`
	Tools             []yandexTool           `json:"tools,omitempty"`
}

type yandexOptions struct {
	Stream      bool    `json:"stream"`
	Temperature float64 `json:"temperature"`
	MaxTokens   string  `json:"maxTokens"`
}

type yandexTool struct {
	Function yandexFunctionTool `json:"function"`
}

type yandexFunctionTool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"`
}

type yandexResponse struct {
	Result struct {
		Alternatives []struct {
			Message yandexMessage `json:"message"`
			Status  string        `json:"status"`
		} `json:"alternatives"`
	} `json:"result"`
}

func (p *YandexGPTProvider) ChatCompletion(ctx context.Context, req LLMCompletionRequest) (*LLMCompletionResponse, error) {
	modelURI := fmt.Sprintf("gpt://%s/%s/latest", p.folderID, p.model)

	// Convert messages
	msgs := make([]yandexMessage, 0, len(req.Messages))
	var toolDescriptions strings.Builder

	for _, m := range req.Messages {
		role := m.Role
		// Map roles: "tool" and "system" → "assistant" for Yandex
		switch role {
		case "system", "tool":
			role = "assistant"
		}
		content := m.Content

		// Append tool result context for "tool" role messages
		if m.Role == "tool" {
			content = fmt.Sprintf("Tool result (%s): %s", m.ToolCallID, content)
		}

		msgs = append(msgs, yandexMessage{Role: role, Text: content})
	}

	// Build tool descriptions into the system message if tools are provided
	if len(req.Tools) > 0 {
		toolDescriptions.WriteString("\n\nAvailable tools (respond with a JSON function call if needed):\n")
		for _, t := range req.Tools {
			toolDescriptions.WriteString(fmt.Sprintf("\n- %s: %s\n  Arguments: %s\n", t.Name, t.Description, string(t.Parameters)))
		}
		toolDescriptions.WriteString("\nTo call a tool, respond with a JSON object:\n{\"tool\": \"<tool_name>\", \"arguments\": {<args>}}\nIf you don't need to call a tool, respond with a plain text answer.\n")

		// Append tool descriptions to the last assistant message (system equivalent)
		for i := len(msgs) - 1; i >= 0; i-- {
			if msgs[i].Role == "assistant" {
				msgs[i].Text += toolDescriptions.String()
				break
			}
		}
	}

	// Convert tools for Yandex format
	var yandexTools []yandexTool
	for _, t := range req.Tools {
		yandexTools = append(yandexTools, yandexTool{
			Function: yandexFunctionTool{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			},
		})
	}

	body := yandexRequest{
		ModelURI: modelURI,
		CompletionOptions: yandexOptions{
			Stream:      false,
			Temperature: 0.6,
			MaxTokens:   "2000",
		},
		Messages: msgs,
	}
	if len(yandexTools) > 0 {
		body.Tools = yandexTools
	}

	payload, _ := json.Marshal(body)

	httpReq, err := http.NewRequestWithContext(ctx, "POST",
		"https://llm.api.cloud.yandex.net/foundationModels/v1/completion",
		bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("yandex: create request: %w", err)
	}

	httpReq.Header.Set("Authorization", "Api-Key "+p.apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("yandex: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("yandex: HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var yresp yandexResponse
	if err := json.NewDecoder(resp.Body).Decode(&yresp); err != nil {
		return nil, fmt.Errorf("yandex: decode response: %w", err)
	}

	if len(yresp.Result.Alternatives) == 0 {
		return &LLMCompletionResponse{
			Message: LLMMessage{Role: "assistant", Content: "No response from YandexGPT"},
		}, nil
	}

	text := yresp.Result.Alternatives[0].Message.Text

	// Check if the response contains a JSON tool call
	var toolCalls []LLMToolCall
	if trimmed := strings.TrimSpace(text); strings.HasPrefix(trimmed, "{") {
		var tcRequest struct {
			Tool      string          `json:"tool"`
			Arguments json.RawMessage `json:"arguments"`
		}
		if err := json.Unmarshal([]byte(trimmed), &tcRequest); err == nil && tcRequest.Tool != "" {
			toolCalls = append(toolCalls, LLMToolCall{
				ID:        "yc_" + tcRequest.Tool,
				Name:      tcRequest.Tool,
				Arguments: string(tcRequest.Arguments),
			})
			text = "" // Tool call, not final text
		}
	}

	return &LLMCompletionResponse{
		Message: LLMMessage{
			Role:      "assistant",
			Content:   text,
			ToolCalls: toolCalls,
		},
		StopReason: yresp.Result.Alternatives[0].Status,
	}, nil
}
