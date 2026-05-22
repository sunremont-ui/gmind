package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// TaskLogMessage — формат сообщения для SSE.
type TaskLogMessage struct {
	TaskID   string `json:"task_id"`
	AgentID  string `json:"agent_id"`
	Step     int    `json:"step,omitempty"`
	Level    string `json:"level"` // info, debug, warn, error
	Message  string `json:"message,omitempty"`
	Content  string `json:"content,omitempty"`
	ToolName string `json:"tool_name,omitempty"`
	ToolArgs string `json:"tool_args,omitempty"`
	Result   string `json:"result,omitempty"`
	Time     string `json:"time"`
}

// taskLogBroker manages SSE connections for a single task.
type taskLogBroker struct {
	mu        sync.RWMutex
	clients   map[chan TaskLogMessage]struct{}
	messages  []TaskLogMessage
	capacity  int
	createdAt time.Time
}

func newTaskLogBroker(capacity int) *taskLogBroker {
	return &taskLogBroker{
		clients:   make(map[chan TaskLogMessage]struct{}),
		messages:  make([]TaskLogMessage, 0, capacity),
		capacity:  capacity,
		createdAt: time.Now(),
	}
}

func (b *taskLogBroker) register(ch chan TaskLogMessage) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.clients[ch] = struct{}{}
	for _, msg := range b.messages {
		ch <- msg
	}
}

func (b *taskLogBroker) unregister(ch chan TaskLogMessage) {
	b.mu.Lock()
	defer b.mu.Unlock()
	delete(b.clients, ch)
}

func (b *taskLogBroker) publish(msg TaskLogMessage) {
	b.mu.Lock()
	b.messages = append(b.messages, msg)
	if len(b.messages) > b.capacity {
		b.messages = b.messages[len(b.messages)-b.capacity:]
	}
	clients := make(map[chan TaskLogMessage]struct{}, len(b.clients))
	for k, v := range b.clients {
		clients[k] = v
	}
	b.mu.Unlock()
	for ch := range clients {
		select {
		case ch <- msg:
		default:
		}
	}
}

var (
	brokerMu       sync.RWMutex
	taskBrokers    = make(map[string]*taskLogBroker)
	brokerCleanup  sync.Once
)

// startBrokerCleanup runs a background goroutine that evicts brokers with no
// connected clients after a TTL. Called lazily on first broker creation.
func startBrokerCleanup(ctx context.Context) {
	const ttl = 30 * time.Minute
	ticker := time.NewTicker(5 * time.Minute)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				now := time.Now()
				brokerMu.Lock()
				for id, b := range taskBrokers {
					b.mu.RLock()
					idle := len(b.clients) == 0 && now.Sub(b.createdAt) > ttl
					b.mu.RUnlock()
					if idle {
						delete(taskBrokers, id)
					}
				}
				brokerMu.Unlock()
			case <-ctx.Done():
				return
			}
		}
	}()
}

func getOrCreateBroker(taskID string) *taskLogBroker {
	brokerMu.Lock()
	defer brokerMu.Unlock()
	if b, ok := taskBrokers[taskID]; ok {
		return b
	}
	b := newTaskLogBroker(200)
	taskBrokers[taskID] = b
	// Start the periodic cleanup goroutine once (context lives for process lifetime).
	brokerCleanup.Do(func() { startBrokerCleanup(context.Background()) })
	return b
}

// removeBrokerIfEmpty removes the broker when task is fully done.
func removeBrokerIfEmpty(taskID string) {
	brokerMu.Lock()
	defer brokerMu.Unlock()
	if b, ok := taskBrokers[taskID]; ok {
		b.mu.RLock()
		empty := len(b.clients) == 0
		b.mu.RUnlock()
		if empty {
			delete(taskBrokers, taskID)
		}
	}
}

// PublishTaskLog publishes a simple log message.
func PublishTaskLog(taskID, agentID, level, message string) {
	b := getOrCreateBroker(taskID)
	b.publish(TaskLogMessage{
		TaskID:  taskID,
		AgentID: agentID,
		Level:   level,
		Message: message,
		Time:    time.Now().UTC().Format(time.RFC3339Nano),
	})
}

// PublishTaskLogStructured publishes a structured log with step/tool info.
func PublishTaskLogStructured(taskID, agentID, level, toolName, toolArgs, result, message string, step int) {
	b := getOrCreateBroker(taskID)
	b.publish(TaskLogMessage{
		TaskID:   taskID,
		AgentID:  agentID,
		Step:     step,
		Level:    level,
		Message:  message,
		ToolName: toolName,
		ToolArgs: toolArgs,
		Result:   result,
		Time:     time.Now().UTC().Format(time.RFC3339Nano),
	})
}

// StreamTaskLogs — SSE endpoint for real-time task log streaming.
func (h *AgentHandler) StreamTaskLogs(w http.ResponseWriter, r *http.Request) {
	taskID := extractPathParam(r, "taskID")
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "task id is required")
		return
	}
	if h.module == nil || h.module.TaskQueue == nil {
		writeError(w, http.StatusNotFound, "module not available")
		return
	}
	_, err := h.module.TaskQueue.Get(taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	msgCh := make(chan TaskLogMessage, 200)
	broker := getOrCreateBroker(taskID)
	broker.register(msgCh)
	defer func() {
		broker.unregister(msgCh)
		removeBrokerIfEmpty(taskID)
	}()

	ctx := r.Context()

	fmt.Fprintf(w, ":connected\n\n")
	flusher.Flush()

	for {
		select {
		case msg := <-msgCh:
			data, _ := json.Marshal(msg)
			fmt.Fprintf(w, "event: log\ndata: %s\n\n", data)
			flusher.Flush()
		case <-ctx.Done():
			return
		}
	}
}

// GetTaskLogs — REST endpoint for fetching log history.
func (h *AgentHandler) GetTaskLogs(w http.ResponseWriter, r *http.Request) {
	taskID := extractPathParam(r, "taskID")
	if taskID == "" {
		writeError(w, http.StatusBadRequest, "task id is required")
		return
	}

	brokerMu.RLock()
	b, ok := taskBrokers[taskID]
	brokerMu.RUnlock()

	if !ok {
		writeJSON(w, http.StatusOK, []TaskLogMessage{})
		return
	}

	b.mu.RLock()
	msgs := make([]TaskLogMessage, len(b.messages))
	copy(msgs, b.messages)
	b.mu.RUnlock()

	writeJSON(w, http.StatusOK, msgs)
}