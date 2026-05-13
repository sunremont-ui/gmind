package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/gmind/backend/internal/core"
)

// RolePrompt returns the system prompt for a given agent role.
func (ps *PromptStore) RolePrompt(role string) string {
	return ps.Role(role)
}

// SystemPrompt returns the shared system instructions.
func (ps *PromptStore) SystemPrompt() string {
	return ps.System()
}

// ReActLoop executes the agent loop: system prompt → LLM → tool calls → execute → repeat.
func ReActLoop(
	ctx context.Context,
	provider LLMProvider,
	model string,
	agentInfo *AgentInfo,
	executor *ToolExecutor,
	prompts *PromptStore,
	logger core.Logger,
	eventBus core.EventBus,
	task *Task,
	maxCalls int,
) (string, error) {
	tools := GetToolsForRole(agentInfo.Role)

	// Convert our tool defs to LLM tool format
	var llmTools []LLMToolDef
	for _, t := range tools {
		llmTools = append(llmTools, LLMToolDef{
			Name:        t.Name,
			Description: t.Description,
			Parameters:  t.Schema,
		})
	}

	sp := prompts.SystemPrompt()
	rp := prompts.RolePrompt(agentInfo.Role)

	messages := []LLMMessage{
		{Role: "system", Content: sp},
		{Role: "system", Content: rp},
	}

	// Add task context
	taskJSON, _ := json.Marshal(task.Params)
	messages = append(messages, LLMMessage{
		Role:    "user",
		Content: fmt.Sprintf("Task: %s\n\nContext: %s", task.Action, string(taskJSON)),
	})

	callbacks := executor.getCallbacks()

	for i := 0; i < maxCalls; i++ {
		resp, err := provider.ChatCompletion(ctx, LLMCompletionRequest{
			Model:    model,
			Messages: messages,
			Tools:    llmTools,
		})
		if err != nil {
			msg := fmt.Sprintf("LLM call %d failed: %v", i+1, err)
			logger.Error(msg)
			eventBus.Publish(core.Event{
				Type:   "agent:task_log",
				Source: "agent",
				Payload: map[string]any{
					"task_id": task.ID,
					"agent_id": task.AgentID,
					"step":     i + 1,
					"message":  msg,
					"level":    "error",
				},
			})
			return "", errors.New(msg)
		}

		if resp == nil {
			return "", fmt.Errorf("no response from LLM at step %d", i+1)
		}

		msg := resp.Message

		// Publish LLM thought event
		eventBus.Publish(core.Event{
			Type:   "agent:task_log",
			Source: "agent",
			Payload: map[string]any{
				"task_id":  task.ID,
				"agent_id": task.AgentID,
				"step":     i + 1,
				"role":     "assistant",
				"content":  msg.Content,
				"tool_calls": len(msg.ToolCalls),
				"level":    "info",
			},
		})

		// Add assistant message to history
		messages = append(messages, msg)

		// If no tool calls, this is the final answer
		if len(msg.ToolCalls) == 0 {
			logger.Debug("agent finished", "id", agentInfo.ID, "steps", i+1)
			return msg.Content, nil
		}

		// Process tool calls
		for _, tc := range msg.ToolCalls {
			if tc.Name == "" {
				continue
			}

			logger.Debug("tool call", "agent", agentInfo.ID, "tool", tc.Name, "args", tc.Arguments)

			// Publish tool call event
			eventBus.Publish(core.Event{
				Type:   "agent:task_log",
				Source: "agent",
				Payload: map[string]any{
					"task_id":   task.ID,
					"agent_id":  task.AgentID,
					"step":      i + 1,
					"tool_name": tc.Name,
					"tool_args": tc.Arguments,
					"level":     "debug",
				},
			})

			// Validate JSON schema before executing
			var argsRaw json.RawMessage
			if err := json.Unmarshal([]byte(tc.Arguments), &argsRaw); err != nil {
				errMsg := fmt.Sprintf("invalid JSON arguments: %v", err)
				messages = append(messages, LLMMessage{
					Role:       "tool",
					ToolCallID: tc.ID,
					Content:    errMsg,
				})
				eventBus.Publish(core.Event{
					Type:   "agent:task_log",
					Source: "agent",
					Payload: map[string]any{
						"task_id":  task.ID,
						"agent_id": task.AgentID,
						"step":     i + 1,
						"message":  errMsg,
						"level":    "warn",
					},
				})
				continue
			}

			// Inject workbook_id and sheet_id from task context
			injected, err := injectContext(argsRaw, task.WorkbookID, task.SheetID)
			if err != nil {
				logger.Error("inject context failed", "error", err)
			}

			// Execute the tool
			cb, ok := callbacks[tc.Name]
			if !ok {
				messages = append(messages, LLMMessage{
					Role:       "tool",
					ToolCallID: tc.ID,
					Content:    "unknown tool: " + tc.Name,
				})
				eventBus.Publish(core.Event{
					Type:   "agent:task_log",
					Source: "agent",
					Payload: map[string]any{
						"task_id":  task.ID,
						"agent_id": task.AgentID,
						"step":     i + 1,
						"message":  "unknown tool: " + tc.Name,
						"level":    "warn",
					},
				})
				continue
			}

			result, err := cb(injected)
			var resultJSON []byte
			if err != nil {
				logger.Warn("tool error", "tool", tc.Name, "error", err)
				resultJSON, _ = json.Marshal(map[string]string{"error": err.Error()})
				eventBus.Publish(core.Event{
					Type:   "agent:task_log",
					Source: "agent",
					Payload: map[string]any{
						"task_id":  task.ID,
						"agent_id": task.AgentID,
						"step":     i + 1,
						"tool_name": tc.Name,
						"message":  err.Error(),
						"level":    "error",
					},
				})
			} else {
				resultJSON, _ = json.Marshal(result)
				eventBus.Publish(core.Event{
					Type:   "agent:task_log",
					Source: "agent",
					Payload: map[string]any{
						"task_id":   task.ID,
						"agent_id":  task.AgentID,
						"step":      i + 1,
						"tool_name": tc.Name,
						"result":    string(resultJSON),
						"level":     "debug",
					},
				})
			}

			messages = append(messages, LLMMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Content:    string(resultJSON),
			})
		}
	}

	// Max calls reached — return last assistant response
	return fmt.Sprintf("Reached maximum of %d tool calls", maxCalls), nil
}

// injectContext adds workbook_id and sheet_id to the tool call arguments if missing.
func injectContext(raw json.RawMessage, workbookID, sheetID string) (json.RawMessage, error) {
	var args map[string]any
	if err := json.Unmarshal(raw, &args); err != nil {
		return raw, err
	}
	if _, ok := args["workbook_id"]; !ok && workbookID != "" {
		args["workbook_id"] = workbookID
	}
	if _, ok := args["sheet_id"]; !ok && sheetID != "" {
		args["sheet_id"] = sheetID
	}
	return json.Marshal(args)
}

// RunTask is the top-level function to execute a task for an agent.
func RunTask(
	ctx context.Context,
	provider LLMProvider,
	model string,
	agentInfo *AgentInfo,
	executor *ToolExecutor,
	prompts *PromptStore,
	taskQueue *TaskQueue,
	eventBus core.EventBus,
	logger core.Logger,
	taskID string,
) {
	task, err := taskQueue.Get(taskID)
	if err != nil {
		logger.Error("task not found for execution", "id", taskID)
		return
	}

	logger.Info("running task", "id", task.ID, "agent", task.AgentID, "action", task.Action)

	eventBus.Publish(core.Event{
		Type:   "agent:task_started",
		Source: "agent",
		Payload: map[string]any{
			"task_id":  task.ID,
			"agent_id": task.AgentID,
			"action":   task.Action,
		},
	})

	start := time.Now()
	result, err := ReActLoop(ctx, provider, model, agentInfo, executor, prompts, logger, eventBus, task, task.MaxCalls)
	duration := time.Since(start)

	if err != nil {
		taskQueue.Fail(taskID, err)
		eventBus.Publish(core.Event{
			Type:   "agent:task_failed",
			Source: "agent",
			Payload: map[string]any{
				"task_id":  task.ID,
				"agent_id": task.AgentID,
				"error":    err.Error(),
				"duration": duration.String(),
			},
		})
		logger.Error("task failed", "id", task.ID, "error", err)
		return
	}

	resultData, _ := json.Marshal(map[string]string{"result": result})
	taskQueue.Complete(taskID, resultData)

	eventBus.Publish(core.Event{
		Type:   "agent:task_completed",
		Source: "agent",
		Payload: map[string]any{
			"task_id":  task.ID,
			"agent_id": task.AgentID,
			"duration": duration.String(),
			"result":   result,
		},
	})
	logger.Info("task completed", "id", task.ID, "duration", duration.String())
}
