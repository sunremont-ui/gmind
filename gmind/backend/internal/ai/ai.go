package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/gmind/backend/internal/model"
	openai "github.com/sashabaranov/go-openai"
)

type AI struct {
	mu     sync.RWMutex
	client *openai.Client
	model  string
}

func New(apiKey, baseURL, modelName string) *AI {
	return &AI{
		client: newClient(apiKey, baseURL),
		model:  modelName,
	}
}

func newClient(apiKey, baseURL string) *openai.Client {
	config := openai.DefaultConfig(apiKey)
	if baseURL != "" {
		config.BaseURL = baseURL
	}
	return openai.NewClientWithConfig(config)
}

func (a *AI) UpdateEndpoint(apiKey, baseURL, modelName string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.client = newClient(apiKey, baseURL)
	a.model = modelName
}

type GenerateResult struct {
	Topics []GenerateTopic `json:"topics"`
}

type GenerateTopic struct {
	Title    string          `json:"title"`
	Children []GenerateTopic `json:"children,omitempty"`
}

func (a *AI) GenerateMindMap(ctx context.Context, prompt string) (*GenerateResult, error) {
	a.mu.RLock()
	client := a.client
	model := a.model
	a.mu.RUnlock()

	systemPrompt := `You are a mind map generator. Create a hierarchical mind map structure based on the user's request.
Respond ONLY with valid JSON in this exact format:
{
  "topics": [
    {
      "title": "Topic title",
      "children": [
        { "title": "Sub-topic", "children": [] }
      ]
    }
  ]
}
Keep topics concise (2-5 words each). Maximum 3 levels deep.`

	resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{Role: openai.ChatMessageRoleUser, Content: prompt},
		},
		Temperature: 0.7,
	})
	if err != nil {
		return nil, fmt.Errorf("ai generate: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from AI")
	}

	var result GenerateResult
	content := resp.Choices[0].Message.Content

	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("parse AI response: %w", err)
	}

	return &result, nil
}

func (a *AI) ExpandTopic(ctx context.Context, title string, existingChildren []string) (*GenerateResult, error) {
	childrenStr := ""
	for _, c := range existingChildren {
		childrenStr += fmt.Sprintf("- %s\n", c)
	}

	prompt := fmt.Sprintf(`Topic: "%s"

Existing sub-topics:
%s
Suggest 3-5 new sub-topics that would complement the existing ones.`, title, childrenStr)

	return a.GenerateMindMap(ctx, prompt)
}

type ChatResult struct {
	Reply       string               `json:"reply"`
	Suggestions []model.AISuggestion `json:"suggestions,omitempty"`
}

func (a *AI) GenerateImage(ctx context.Context, prompt string) (string, error) {
	a.mu.RLock()
	client := a.client
	a.mu.RUnlock()

	resp, err := client.CreateImage(ctx, openai.ImageRequest{
		Prompt:         prompt,
		Model:          openai.CreateImageModelDallE3,
		N:              1,
		Size:           openai.CreateImageSize1024x1024,
		ResponseFormat: openai.CreateImageResponseFormatB64JSON,
	})
	if err != nil {
		return "", fmt.Errorf("ai image: %w", err)
	}
	if len(resp.Data) == 0 {
		return "", errors.New("no image generated")
	}
	return resp.Data[0].B64JSON, nil
}

func (a *AI) Chat(ctx context.Context, message string, mindMapData string) (*ChatResult, error) {
	a.mu.RLock()
	client := a.client
	model := a.model
	a.mu.RUnlock()

	systemPrompt := `You are an AI assistant integrated into a mind mapping application. 
You have access to the current mind map structure in JSON format.

Your capabilities:
1. Answer questions about the mind map content
2. Suggest new topics to add
3. Suggest restructuring of topics
4. Help brainstorm and expand ideas

When suggesting changes, format them so the application can apply them.
Keep responses concise and actionable.`

	resp, err := client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model: model,
		Messages: []openai.ChatCompletionMessage{
			{Role: openai.ChatMessageRoleSystem, Content: systemPrompt},
			{Role: openai.ChatMessageRoleUser, Content: fmt.Sprintf("Current mind map:\n%s\n\nUser message: %s", mindMapData, message)},
		},
		Temperature: 0.7,
	})
	if err != nil {
		return nil, fmt.Errorf("ai chat: %w", err)
	}

	if len(resp.Choices) == 0 {
		return nil, errors.New("no response from AI")
	}

	return &ChatResult{
		Reply: resp.Choices[0].Message.Content,
	}, nil
}
