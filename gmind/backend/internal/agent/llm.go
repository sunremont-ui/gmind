package agent

import (
	"context"
	"encoding/json"

	openai "github.com/sashabaranov/go-openai"
)

// LLMMessage represents a single message in the chat history.
type LLMMessage struct {
	Role       string        `json:"role"`
	Content    string        `json:"content"`
	ToolCallID string        `json:"tool_call_id,omitempty"`
	ToolCalls  []LLMToolCall `json:"tool_calls,omitempty"`
}

// LLMToolCall represents a function call made by the LLM.
type LLMToolCall struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

// LLMToolDef describes a tool available to the LLM.
type LLMToolDef struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"` // JSON Schema
}

// LLMCompletionRequest is the request to the LLM provider.
type LLMCompletionRequest struct {
	Model    string       `json:"model"`
	Messages []LLMMessage `json:"messages"`
	Tools    []LLMToolDef `json:"tools,omitempty"`
}

// LLMCompletionResponse is the response from the LLM provider.
type LLMCompletionResponse struct {
	Message    LLMMessage `json:"message"`
	StopReason string     `json:"stop_reason,omitempty"`
}

// LLMProvider is the interface for LLM backends.
type LLMProvider interface {
	ChatCompletion(ctx context.Context, req LLMCompletionRequest) (*LLMCompletionResponse, error)
}

// OpenAIProvider implements LLMProvider using the OpenAI API.
type OpenAIProvider struct {
	client *openai.Client
	model  string
}

func NewOpenAIProvider(client *openai.Client, model string) *OpenAIProvider {
	return &OpenAIProvider{client: client, model: model}
}

func (p *OpenAIProvider) ChatCompletion(ctx context.Context, req LLMCompletionRequest) (*LLMCompletionResponse, error) {
	messages := make([]openai.ChatCompletionMessage, len(req.Messages))
	for i, m := range req.Messages {
		msg := openai.ChatCompletionMessage{
			Role:       m.Role,
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
		}
		// Convert tool calls from our format to OpenAI format
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				msg.ToolCalls = append(msg.ToolCalls, openai.ToolCall{
					ID:   tc.ID,
					Type: "function",
					Function: openai.FunctionCall{
						Name:      tc.Name,
						Arguments: tc.Arguments,
					},
				})
			}
		}
		messages[i] = msg
	}

	tools := make([]openai.Tool, len(req.Tools))
	for i, t := range req.Tools {
		var params map[string]any
		json.Unmarshal(t.Parameters, &params)
		tools[i] = openai.Tool{
			Type: openai.ToolTypeFunction,
			Function: &openai.FunctionDefinition{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  params,
			},
		}
	}

	model := req.Model
	if model == "" {
		model = p.model
	}

	resp, err := p.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:    model,
		Messages: messages,
		Tools:    tools,
	})
	if err != nil {
		return nil, err
	}

	if len(resp.Choices) == 0 {
		return &LLMCompletionResponse{
			Message: LLMMessage{Role: "assistant", Content: "No response from LLM"},
		}, nil
	}

	choice := resp.Choices[0]
	result := &LLMCompletionResponse{
		Message: LLMMessage{
			Role:    choice.Message.Role,
			Content: choice.Message.Content,
		},
		StopReason: string(choice.FinishReason),
	}

	// Convert OpenAI tool calls to our format
	if len(choice.Message.ToolCalls) > 0 {
		for _, tc := range choice.Message.ToolCalls {
			result.Message.ToolCalls = append(result.Message.ToolCalls, LLMToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: tc.Function.Arguments,
			})
		}
	}

	return result, nil
}
