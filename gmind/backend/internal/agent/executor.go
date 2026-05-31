package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/rag"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/wiki"
)

// ToolExecutor executes tool calls against the store.
type ToolExecutor struct {
	store        *store.Store
	eventBus     core.EventBus
	logger       core.Logger
	searcher     Searcher
	wiki         *wiki.Store
	ragService   *rag.Service
	relStore     *store.RelationshipStore
	maSysBaseURL string
	manager      *Manager

	// workbookLocks prevents concurrent mutations to the same workbook.
	workbookLocks sync.Map // map[string]*sync.Mutex

	// extraCallbacks allows modules to register additional tool handlers.
	extraCallbacksMu sync.RWMutex
	extraCallbacks   map[string]callToolFn
}

// RegisterCallback registers an additional tool callback. Safe for concurrent use.
func (e *ToolExecutor) RegisterCallback(name string, fn callToolFn) {
	e.extraCallbacksMu.Lock()
	defer e.extraCallbacksMu.Unlock()
	if e.extraCallbacks == nil {
		e.extraCallbacks = make(map[string]callToolFn)
	}
	e.extraCallbacks[name] = fn
}

func NewToolExecutor(s *store.Store, eventBus core.EventBus, logger core.Logger, wikiStore *wiki.Store) *ToolExecutor {
	return &ToolExecutor{
		store:        s,
		eventBus:     eventBus,
		logger:       logger,
		searcher:     NewDuckDuckGoSearcher(),
		wiki:         wikiStore,
		maSysBaseURL: "http://localhost:3001",
	}
}

func (e *ToolExecutor) SetMaSysBaseURL(url string) {
	e.maSysBaseURL = url
}

// SetRAG wires a RAG service for semantic_search tool support.
func (e *ToolExecutor) SetRAG(svc *rag.Service) {
	e.ragService = svc
}

// SetRelationshipStore wires the V5.0 graph relationship store for graph tools.
func (e *ToolExecutor) SetRelationshipStore(rs *store.RelationshipStore) {
	e.relStore = rs
}

func (e *ToolExecutor) SetManager(m *Manager) {
	e.manager = m
}

func (e *ToolExecutor) lockWorkbook(id string) *sync.Mutex {
	mu, _ := e.workbookLocks.LoadOrStore(id, &sync.Mutex{})
	return mu.(*sync.Mutex)
}

type callToolFn func(args json.RawMessage) (any, error)

func (e *ToolExecutor) getCallbacks(task *Task) map[string]callToolFn {
	base := map[string]callToolFn{
		"create_topic":           e.createTopic,
		"update_topic":           e.updateTopic,
		"create_multiple_topics": e.createMultipleTopics,
		"add_note":               e.addNote,
		"get_topic":              e.getTopic,
		"get_workbook":           e.getWorkbook,
		"summarize_topics":       e.summarizeTopics,
		"search_web":             e.searchWeb,
		"wiki_search":            e.wikiSearch,
		"wiki_read":              e.wikiRead,
		"wiki_write":             e.wikiWrite,
		"run_masys_pipeline":     e.runMaSysPipeline,
		"delete_topic":           e.deleteTopic,
		"move_topic":             e.moveTopic,
		"list_topics":            e.listTopics,
		"save_note":              e.saveNote,
		"search_notes":           e.searchNotes,
		"semantic_search":        e.semanticSearch,
		"delegate_to_agent": func(raw json.RawMessage) (any, error) {
			return e.delegateToAgent(raw, task)
		},
		"parallel_delegate": func(raw json.RawMessage) (any, error) {
			return e.parallelDelegate(raw, task)
		},
		"list_agents": e.listAgents,
		"create_relationship": func(raw json.RawMessage) (any, error) {
			return e.createRelationship(raw, task)
		},
		"list_relationships":  e.listRelationships,
		"get_related_topics":  e.getRelatedTopics,
		"detect_cycles":       e.detectCyclesTool,
		"update_relationship": e.updateRelationshipTool,
		"delete_relationship": e.deleteRelationshipTool,
	}
	// Merge module-registered callbacks (they can override or extend base tools).
	e.extraCallbacksMu.RLock()
	for name, fn := range e.extraCallbacks {
		base[name] = fn
	}
	e.extraCallbacksMu.RUnlock()
	return base
}

func (e *ToolExecutor) runMaSysPipeline(raw json.RawMessage) (any, error) {
	var args struct {
		PipelineID string         `json:"pipeline_id"`
		Inputs     map[string]any `json:"inputs,omitempty"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid run_masys_pipeline args: %w", err)
	}
	if args.PipelineID == "" {
		return nil, errors.New("pipeline_id is required")
	}

	payload, err := json.Marshal(map[string]any{
		"inputs":    args.Inputs,
		"timeoutMs": 120000,
	})
	if err != nil {
		return nil, fmt.Errorf("marshal inputs: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 130*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "POST",
		fmt.Sprintf("%s/invoke/%s", e.maSysBaseURL, args.PipelineID),
		bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := (&http.Client{Timeout: 130 * time.Second}).Do(req)
	if err != nil {
		return nil, fmt.Errorf("MASys invoke failed: %w", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("MASys invoke error %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		RunID      string                            `json:"runId"`
		Success    bool                              `json:"success"`
		DurationMs int64                             `json:"durationMs"`
		Outputs    map[string]map[string]interface{} `json:"outputs"`
		Error      *string                           `json:"error"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("MASys invoke parse error: %w", err)
	}

	out := map[string]any{
		"run_id":      result.RunID,
		"success":     result.Success,
		"duration_ms": result.DurationMs,
		"outputs":     result.Outputs,
	}
	if result.Error != nil {
		out["error"] = *result.Error
	}
	return out, nil
}

func (e *ToolExecutor) createTopic(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string          `json:"workbook_id"`
		SheetID    string          `json:"sheet_id"`
		ParentID   string          `json:"parent_id"`
		Title      string          `json:"title"`
		Position   *model.Position `json:"position,omitempty"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid create_topic args: %w", err)
	}

	e.lockWorkbook(args.WorkbookID).Lock()
	defer e.lockWorkbook(args.WorkbookID).Unlock()

	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	topic := model.NewTopic(args.Title)
	if args.Position != nil {
		topic.Position = args.Position
	}
	for _, sheet := range wb.Sheets {
		if args.SheetID != "" && sheet.ID != args.SheetID {
			continue
		}
		if parent := sheet.FindTopic(args.ParentID); parent != nil {
			parent.AddChild(topic)
			if err := e.store.UpdateWorkbook(wb); err != nil {
				return nil, err
			}
			e.publishTopicCreated(args.WorkbookID, topic)
			return topic, nil
		}
	}
	return nil, fmt.Errorf("parent topic %s not found", args.ParentID)
}

func (e *ToolExecutor) createMultipleTopics(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string   `json:"workbook_id"`
		SheetID    string   `json:"sheet_id"`
		ParentID   string   `json:"parent_id"`
		Titles     []string `json:"titles"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid create_multiple_topics args: %w", err)
	}

	e.lockWorkbook(args.WorkbookID).Lock()
	defer e.lockWorkbook(args.WorkbookID).Unlock()

	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	var created []*model.Topic
	for _, sheet := range wb.Sheets {
		if args.SheetID != "" && sheet.ID != args.SheetID {
			continue
		}
		parent := sheet.FindTopic(args.ParentID)
		if parent == nil {
			continue
		}
		for _, title := range args.Titles {
			t := model.NewTopic(title)
			parent.AddChild(t)
			created = append(created, t)
			e.publishTopicCreated(args.WorkbookID, t)
		}
		if err := e.store.UpdateWorkbook(wb); err != nil {
			return nil, err
		}
		return created, nil
	}
	return nil, fmt.Errorf("parent topic %s not found", args.ParentID)
}

func (e *ToolExecutor) updateTopic(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string `json:"workbook_id"`
		TopicID    string `json:"topic_id"`
		Title      string `json:"title,omitempty"`
		Notes      string `json:"notes,omitempty"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid update_topic args: %w", err)
	}

	e.lockWorkbook(args.WorkbookID).Lock()
	defer e.lockWorkbook(args.WorkbookID).Unlock()

	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	for _, sheet := range wb.Sheets {
		if topic := sheet.FindTopic(args.TopicID); topic != nil {
			oldTitle := topic.Title
			if args.Title != "" {
				topic.Title = args.Title
			}
			if args.Notes != "" {
				topic.Notes = args.Notes
			}
			if err := e.store.UpdateWorkbook(wb); err != nil {
				return nil, err
			}
			e.publishTopicUpdated(args.WorkbookID, args.TopicID, oldTitle, topic.Title)
			return map[string]string{"status": "updated", "topic_id": args.TopicID}, nil
		}
	}
	return nil, fmt.Errorf("topic %s not found", args.TopicID)
}

func (e *ToolExecutor) addNote(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string `json:"workbook_id"`
		TopicID    string `json:"topic_id"`
		Notes      string `json:"notes"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid add_note args: %w", err)
	}

	e.lockWorkbook(args.WorkbookID).Lock()
	defer e.lockWorkbook(args.WorkbookID).Unlock()

	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	for _, sheet := range wb.Sheets {
		if topic := sheet.FindTopic(args.TopicID); topic != nil {
			topic.Notes = args.Notes
			if err := e.store.UpdateWorkbook(wb); err != nil {
				return nil, err
			}
			e.publishTopicUpdated(args.WorkbookID, args.TopicID, topic.Title, topic.Title)
			return map[string]string{"status": "note_added", "topic_id": args.TopicID}, nil
		}
	}
	return nil, fmt.Errorf("topic %s not found", args.TopicID)
}

// Read-only tools — no lock needed.

func (e *ToolExecutor) getTopic(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string `json:"workbook_id"`
		TopicID    string `json:"topic_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid get_topic args: %w", err)
	}
	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	for _, sheet := range wb.Sheets {
		if topic := sheet.FindTopic(args.TopicID); topic != nil {
			return topic, nil
		}
	}
	return nil, fmt.Errorf("topic %s not found", args.TopicID)
}

func (e *ToolExecutor) getWorkbook(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string `json:"workbook_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid get_workbook args: %w", err)
	}
	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	if wb == nil {
		return nil, fmt.Errorf("workbook %s not found", args.WorkbookID)
	}
	type topicSummary struct {
		ID    string         `json:"id"`
		Title string         `json:"title"`
		Kids  []topicSummary `json:"children,omitempty"`
	}
	var summarize func(t *model.Topic) topicSummary
	summarize = func(t *model.Topic) topicSummary {
		s := topicSummary{ID: t.ID, Title: t.Title}
		for _, c := range t.Children {
			s.Kids = append(s.Kids, summarize(c))
		}
		return s
	}
	type sheetSum struct {
		ID    string       `json:"id"`
		Title string       `json:"title"`
		Root  topicSummary `json:"root_topic"`
	}
	var result struct {
		ID     string     `json:"id"`
		Title  string     `json:"title"`
		Sheets []sheetSum `json:"sheets"`
	}
	result.ID = wb.ID
	result.Title = wb.Title
	for _, s := range wb.Sheets {
		result.Sheets = append(result.Sheets, sheetSum{
			ID: s.ID, Title: s.Title, Root: summarize(s.RootTopic),
		})
	}
	return result, nil
}

func (e *ToolExecutor) summarizeTopics(raw json.RawMessage) (any, error) {
	var args struct {
		Topics    []string `json:"topics"`
		MaxPoints int      `json:"max_points"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid summarize_topics args: %w", err)
	}
	if args.MaxPoints <= 0 {
		args.MaxPoints = 5
	}
	if len(args.Topics) == 0 {
		return nil, errors.New("no topics provided")
	}
	points := args.Topics
	if len(points) > args.MaxPoints {
		points = points[:args.MaxPoints]
	}
	return map[string]any{"summary": points}, nil
}

func (e *ToolExecutor) searchWeb(raw json.RawMessage) (any, error) {
	var args struct {
		Query      string `json:"query"`
		MaxResults int    `json:"max_results"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid search_web args: %w", err)
	}
	if args.MaxResults <= 0 {
		args.MaxResults = 5
	}
	if args.MaxResults > 10 {
		args.MaxResults = 10
	}

	results, err := e.searcher.Search(args.Query, args.MaxResults)
	if err != nil {
		e.logger.Warn("search_web failed, returning fallback", "error", err)
		fallback := fmt.Sprintf("Search for %q: %d results (simulated — search backend unavailable)", args.Query, args.MaxResults)
		return map[string]any{"results": []string{fallback}, "source": "fallback"}, nil
	}

	return map[string]any{"results": results, "source": "duckduckgo"}, nil
}

func (e *ToolExecutor) publishTopicCreated(workbookID string, topic *model.Topic) {
	if e.eventBus == nil {
		return
	}
	e.eventBus.Publish(core.Event{
		Type:   "topic:created",
		Source: "agent",
		Payload: map[string]any{
			"workbook_id": workbookID,
			"topic_id":    topic.ID,
			"title":       topic.Title,
		},
	})
}

func (e *ToolExecutor) wikiSearch(raw json.RawMessage) (any, error) {
	if e.wiki == nil {
		return nil, errors.New("wiki module not available")
	}
	var args struct {
		Query      string `json:"query"`
		MaxResults int    `json:"max_results"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid wiki_search args: %w", err)
	}
	if args.Query == "" {
		return nil, errors.New("query is required")
	}
	if args.MaxResults <= 0 {
		args.MaxResults = 5
	}

	results, err := e.wiki.Search(args.Query, args.MaxResults)
	if err != nil {
		return nil, fmt.Errorf("wiki search failed: %w", err)
	}
	return map[string]any{"results": results, "count": len(results)}, nil
}

func (e *ToolExecutor) wikiRead(raw json.RawMessage) (any, error) {
	if e.wiki == nil {
		return nil, errors.New("wiki module not available")
	}
	var args struct {
		Slug string `json:"slug"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid wiki_read args: %w", err)
	}
	if args.Slug == "" {
		return nil, errors.New("slug is required")
	}

	page, err := e.wiki.Read(args.Slug)
	if err != nil {
		return nil, err
	}
	return page, nil
}

func (e *ToolExecutor) wikiWrite(raw json.RawMessage) (any, error) {
	if e.wiki == nil {
		return nil, errors.New("wiki module not available")
	}
	var args struct {
		Slug    string `json:"slug"`
		Content string `json:"content"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid wiki_write args: %w", err)
	}
	if args.Slug == "" {
		return nil, errors.New("slug is required")
	}
	if args.Content == "" {
		return nil, errors.New("content is required")
	}

	page, err := e.wiki.Write(args.Slug, args.Content)
	if err != nil {
		return nil, fmt.Errorf("wiki write failed: %w", err)
	}
	return map[string]any{"status": "written", "slug": page.Slug, "title": page.Title}, nil
}

func (e *ToolExecutor) publishTopicUpdated(workbookID, topicID, oldTitle, newTitle string) {
	if e.eventBus == nil {
		return
	}
	e.eventBus.Publish(core.Event{
		Type:   "topic:updated",
		Source: "agent",
		Payload: map[string]any{
			"workbook_id": workbookID,
			"topic_id":    topicID,
			"old_title":   oldTitle,
			"new_title":   newTitle,
		},
	})
}

func (e *ToolExecutor) deleteTopic(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string `json:"workbook_id"`
		SheetID    string `json:"sheet_id"`
		TopicID    string `json:"topic_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid delete_topic args: %w", err)
	}
	if args.TopicID == "" {
		return nil, errors.New("topic_id is required")
	}

	e.lockWorkbook(args.WorkbookID).Lock()
	defer e.lockWorkbook(args.WorkbookID).Unlock()

	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	for _, sheet := range wb.Sheets {
		if args.SheetID != "" && sheet.ID != args.SheetID {
			continue
		}
		if sheet.RemoveTopic(args.TopicID) {
			if err := e.store.UpdateWorkbook(wb); err != nil {
				return nil, err
			}
			if e.eventBus != nil {
				e.eventBus.Publish(core.Event{
					Type:   "topic:deleted",
					Source: "agent",
					Payload: map[string]any{
						"workbook_id": args.WorkbookID,
						"topic_id":    args.TopicID,
					},
				})
			}
			return map[string]string{"status": "deleted", "topic_id": args.TopicID}, nil
		}
	}
	return nil, fmt.Errorf("topic %s not found or is root topic", args.TopicID)
}

func (e *ToolExecutor) moveTopic(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID  string `json:"workbook_id"`
		SheetID     string `json:"sheet_id"`
		TopicID     string `json:"topic_id"`
		NewParentID string `json:"new_parent_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid move_topic args: %w", err)
	}
	if args.TopicID == "" || args.NewParentID == "" {
		return nil, errors.New("topic_id and new_parent_id are required")
	}
	if args.TopicID == args.NewParentID {
		return nil, errors.New("cannot move topic to itself")
	}

	e.lockWorkbook(args.WorkbookID).Lock()
	defer e.lockWorkbook(args.WorkbookID).Unlock()

	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	for _, sheet := range wb.Sheets {
		if args.SheetID != "" && sheet.ID != args.SheetID {
			continue
		}
		topic := sheet.FindTopic(args.TopicID)
		if topic == nil {
			continue
		}
		newParent := sheet.FindTopic(args.NewParentID)
		if newParent == nil {
			return nil, fmt.Errorf("new parent topic %s not found", args.NewParentID)
		}
		if !sheet.RemoveTopic(args.TopicID) {
			return nil, fmt.Errorf("failed to remove topic %s from current location", args.TopicID)
		}
		newParent.AddChild(topic)
		if err := e.store.UpdateWorkbook(wb); err != nil {
			return nil, err
		}
		if e.eventBus != nil {
			e.eventBus.Publish(core.Event{
				Type:   "topic:moved",
				Source: "agent",
				Payload: map[string]any{
					"workbook_id":   args.WorkbookID,
					"topic_id":      args.TopicID,
					"new_parent_id": args.NewParentID,
				},
			})
		}
		return map[string]string{"status": "moved", "topic_id": args.TopicID, "new_parent_id": args.NewParentID}, nil
	}
	return nil, fmt.Errorf("topic %s not found", args.TopicID)
}

type topicFlatItem struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	ParentID string `json:"parent_id,omitempty"`
	Depth    int    `json:"depth"`
	Notes    string `json:"notes,omitempty"`
}

func (e *ToolExecutor) listTopics(raw json.RawMessage) (any, error) {
	var args struct {
		WorkbookID string `json:"workbook_id"`
		SheetID    string `json:"sheet_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid list_topics args: %w", err)
	}

	wb, err := e.store.GetWorkbook(args.WorkbookID)
	if err != nil {
		return nil, err
	}
	var items []topicFlatItem
	for _, sheet := range wb.Sheets {
		if args.SheetID != "" && sheet.ID != args.SheetID {
			continue
		}
		if sheet.RootTopic != nil {
			flattenTopicTree(sheet.RootTopic, "", 0, &items)
		}
	}
	return map[string]any{"topics": items, "count": len(items)}, nil
}

func flattenTopicTree(t *model.Topic, parentID string, depth int, items *[]topicFlatItem) {
	*items = append(*items, topicFlatItem{
		ID:       t.ID,
		Title:    t.Title,
		ParentID: parentID,
		Depth:    depth,
		Notes:    t.Notes,
	})
	for _, child := range t.Children {
		flattenTopicTree(child, t.ID, depth+1, items)
	}
}

func (e *ToolExecutor) delegateToAgent(raw json.RawMessage, callerTask *Task) (any, error) {
	var args struct {
		AgentID string         `json:"agent_id"`
		Action  string         `json:"action"`
		Params  map[string]any `json:"params,omitempty"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid delegate_to_agent args: %w", err)
	}
	if args.AgentID == "" || args.Action == "" {
		return nil, errors.New("agent_id and action are required")
	}
	if callerTask != nil && args.AgentID == callerTask.AgentID {
		return nil, errors.New("cannot delegate to self")
	}
	if e.manager == nil {
		return nil, errors.New("agent manager not available")
	}

	workbookID, sheetID, topicID := "", "", ""
	if callerTask != nil {
		workbookID = callerTask.WorkbookID
		sheetID = callerTask.SheetID
		topicID = callerTask.TopicID
	}

	taskID, err := e.manager.SubmitTask(
		args.AgentID, args.Action, args.Params,
		workbookID, sheetID, topicID,
		"", "", "",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to delegate task: %w", err)
	}

	deadline := time.Now().Add(2 * time.Minute)
	for time.Now().Before(deadline) {
		t, err := e.manager.GetTask(taskID)
		if err != nil {
			return nil, fmt.Errorf("delegated task not found: %w", err)
		}
		switch t.Status {
		case TaskDone:
			return map[string]any{
				"task_id": taskID,
				"result":  string(t.Result),
				"status":  "done",
			}, nil
		case TaskFailed:
			return nil, fmt.Errorf("delegated task failed: %s", t.Error)
		}
		time.Sleep(500 * time.Millisecond)
	}
	return nil, fmt.Errorf("delegated task %s timed out after 2 minutes", taskID)
}

func (e *ToolExecutor) listAgents(raw json.RawMessage) (any, error) {
	if e.manager == nil {
		return nil, errors.New("agent manager not available")
	}
	agents := e.manager.registry.List()
	type agentInfo struct {
		ID       string `json:"id"`
		Name     string `json:"name,omitempty"`
		Role     string `json:"role"`
		Status   string `json:"status"`
		Provider string `json:"provider,omitempty"`
		Model    string `json:"model,omitempty"`
	}
	result := make([]agentInfo, 0, len(agents))
	for _, ag := range agents {
		result = append(result, agentInfo{
			ID:       ag.ID,
			Name:     ag.Name,
			Role:     ag.Role,
			Status:   string(ag.Status),
			Provider: ag.Provider,
			Model:    ag.Model,
		})
	}
	return result, nil
}

func (e *ToolExecutor) parallelDelegate(raw json.RawMessage, callerTask *Task) (any, error) {
	var args struct {
		Tasks []struct {
			AgentID string         `json:"agent_id"`
			Action  string         `json:"action"`
			Params  map[string]any `json:"params,omitempty"`
		} `json:"tasks"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid parallel_delegate args: %w", err)
	}
	if len(args.Tasks) == 0 {
		return nil, errors.New("tasks array is required and non-empty")
	}
	if len(args.Tasks) > 16 {
		return nil, fmt.Errorf("parallel_delegate supports up to 16 concurrent tasks (got %d)", len(args.Tasks))
	}
	if e.manager == nil {
		return nil, errors.New("agent manager not available")
	}

	workbookID, sheetID, topicID := "", "", ""
	if callerTask != nil {
		workbookID = callerTask.WorkbookID
		sheetID = callerTask.SheetID
		topicID = callerTask.TopicID
	}
	groupID := "pg_" + time.Now().UTC().Format("20060102150405.000") + "_" + fmt.Sprintf("%d", len(args.Tasks))

	type subResult struct {
		AgentID string `json:"agent_id"`
		TaskID  string `json:"task_id"`
		Status  string `json:"status"`
		Result  string `json:"result,omitempty"`
		Error   string `json:"error,omitempty"`
	}
	results := make([]subResult, len(args.Tasks))
	taskIDs := make([]string, len(args.Tasks))

	for i, t := range args.Tasks {
		if t.AgentID == "" || t.Action == "" {
			return nil, fmt.Errorf("task[%d]: agent_id and action are required", i)
		}
		if callerTask != nil && t.AgentID == callerTask.AgentID {
			return nil, fmt.Errorf("task[%d]: cannot delegate to self", i)
		}
		taskID, err := e.manager.SubmitTaskInGroup(t.AgentID, t.Action, t.Params, workbookID, sheetID, topicID, groupID)
		if err != nil {
			return nil, fmt.Errorf("task[%d]: submit failed: %w", i, err)
		}
		taskIDs[i] = taskID
		results[i] = subResult{AgentID: t.AgentID, TaskID: taskID, Status: "queued"}
	}

	deadline := time.Now().Add(5 * time.Minute)
	remaining := len(taskIDs)
	for remaining > 0 && time.Now().Before(deadline) {
		time.Sleep(500 * time.Millisecond)
		for i, tid := range taskIDs {
			if results[i].Status == "done" || results[i].Status == "failed" {
				continue
			}
			t, err := e.manager.GetTask(tid)
			if err != nil {
				results[i].Status = "failed"
				results[i].Error = err.Error()
				remaining--
				continue
			}
			switch t.Status {
			case TaskDone:
				results[i].Status = "done"
				results[i].Result = string(t.Result)
				remaining--
			case TaskFailed:
				results[i].Status = "failed"
				results[i].Error = t.Error
				remaining--
			}
		}
	}

	if remaining > 0 {
		for i := range results {
			if results[i].Status != "done" && results[i].Status != "failed" {
				results[i].Status = "timeout"
			}
		}
	}

	return map[string]any{
		"group_id": groupID,
		"results":  results,
	}, nil
}

// --- V5.0 Graph Relationship tools ---

func (e *ToolExecutor) createRelationship(raw json.RawMessage, callerTask *Task) (any, error) {
	if e.relStore == nil {
		return nil, errors.New("relationship store not initialized")
	}
	var args struct {
		FromTopicID string  `json:"from_topic_id"`
		ToTopicID   string  `json:"to_topic_id"`
		Type        string  `json:"type"`
		Direction   string  `json:"direction"`
		Title       string  `json:"title"`
		Weight      float64 `json:"weight"`
		Notes       string  `json:"notes"`
		WorkbookID  string  `json:"workbook_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid create_relationship args: %w", err)
	}
	if args.FromTopicID == "" || args.ToTopicID == "" {
		return nil, errors.New("from_topic_id and to_topic_id are required")
	}
	workbookID := args.WorkbookID
	createdBy := "agent"
	if callerTask != nil {
		if workbookID == "" {
			workbookID = callerTask.WorkbookID
		}
		createdBy = "agent_" + callerTask.AgentID
	}
	if workbookID == "" {
		return nil, errors.New("workbook_id is required (no caller context)")
	}
	rec := &store.RelationshipRecord{
		WorkbookID:  workbookID,
		FromTopicID: args.FromTopicID,
		ToTopicID:   args.ToTopicID,
		Type:        args.Type,
		Direction:   args.Direction,
		Title:       args.Title,
		Weight:      args.Weight,
		Notes:       args.Notes,
		CreatedBy:   createdBy,
	}
	if err := e.relStore.Insert(rec); err != nil {
		return nil, fmt.Errorf("insert relationship: %w", err)
	}
	return rec, nil
}

func (e *ToolExecutor) listRelationships(raw json.RawMessage) (any, error) {
	if e.relStore == nil {
		return nil, errors.New("relationship store not initialized")
	}
	var args struct {
		TopicID   string `json:"topic_id"`
		Type      string `json:"type"`
		Direction string `json:"direction"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid list_relationships args: %w", err)
	}
	if args.TopicID == "" {
		return nil, errors.New("topic_id is required")
	}
	rels, err := e.relStore.ListByTopic(args.TopicID)
	if err != nil {
		return nil, fmt.Errorf("list relationships: %w", err)
	}
	if args.Type != "" {
		filtered := make([]*store.RelationshipRecord, 0, len(rels))
		for _, r := range rels {
			if r.Type == args.Type {
				filtered = append(filtered, r)
			}
		}
		rels = filtered
	}
	if args.Direction != "" {
		filtered := make([]*store.RelationshipRecord, 0, len(rels))
		for _, r := range rels {
			if r.Direction == args.Direction {
				filtered = append(filtered, r)
			}
		}
		rels = filtered
	}
	if rels == nil {
		rels = []*store.RelationshipRecord{}
	}
	return rels, nil
}

func (e *ToolExecutor) getRelatedTopics(raw json.RawMessage) (any, error) {
	if e.relStore == nil {
		return nil, errors.New("relationship store not initialized")
	}
	var args struct {
		TopicID string   `json:"topic_id"`
		Depth   int      `json:"depth"`
		Types   []string `json:"types"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid get_related_topics args: %w", err)
	}
	if args.TopicID == "" {
		return nil, errors.New("topic_id is required")
	}
	if args.Depth <= 0 {
		args.Depth = 2
	}
	if args.Depth > 5 {
		args.Depth = 5
	}
	topics, rels, err := e.relStore.Traverse(args.TopicID, args.Depth, args.Types)
	if err != nil {
		return nil, fmt.Errorf("traverse: %w", err)
	}
	return map[string]any{
		"topic_id":      args.TopicID,
		"depth":         args.Depth,
		"types":         args.Types,
		"topics":        topics,
		"relationships": rels,
	}, nil
}

func (e *ToolExecutor) detectCyclesTool(raw json.RawMessage) (any, error) {
	if e.relStore == nil {
		return nil, errors.New("relationship store not initialized")
	}
	var args struct {
		WorkbookID string `json:"workbook_id"`
		Type       string `json:"type"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid detect_cycles args: %w", err)
	}
	if args.WorkbookID == "" {
		return nil, errors.New("workbook_id is required")
	}
	cycles, err := e.relStore.DetectCycles(args.WorkbookID, args.Type)
	if err != nil {
		return nil, fmt.Errorf("detect cycles: %w", err)
	}
	return map[string]any{
		"workbook_id": args.WorkbookID,
		"type":        args.Type,
		"cycles":      cycles,
		"count":       len(cycles),
	}, nil
}

func (e *ToolExecutor) updateRelationshipTool(raw json.RawMessage) (any, error) {
	if e.relStore == nil {
		return nil, errors.New("relationship store not initialized")
	}
	var args struct {
		RelationshipID string   `json:"relationship_id"`
		Type           *string  `json:"type"`
		Direction      *string  `json:"direction"`
		Title          *string  `json:"title"`
		Weight         *float64 `json:"weight"`
		Notes          *string  `json:"notes"`
		Color          *string  `json:"color"`
		Style          *string  `json:"style"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid update_relationship args: %w", err)
	}
	if args.RelationshipID == "" {
		return nil, errors.New("relationship_id is required")
	}
	patch := map[string]any{}
	if args.Type != nil {
		patch["type"] = *args.Type
	}
	if args.Direction != nil {
		patch["direction"] = *args.Direction
	}
	if args.Title != nil {
		patch["title"] = *args.Title
	}
	if args.Weight != nil {
		patch["weight"] = *args.Weight
	}
	if args.Notes != nil {
		patch["notes"] = *args.Notes
	}
	if args.Color != nil {
		patch["color"] = *args.Color
	}
	if args.Style != nil {
		patch["style"] = *args.Style
	}
	if err := e.relStore.Update(args.RelationshipID, patch); err != nil {
		return nil, fmt.Errorf("update relationship: %w", err)
	}
	rec, err := e.relStore.Get(args.RelationshipID)
	if err != nil {
		return nil, fmt.Errorf("get after update: %w", err)
	}
	if rec == nil {
		return nil, fmt.Errorf("relationship %s not found", args.RelationshipID)
	}
	return rec, nil
}

func (e *ToolExecutor) deleteRelationshipTool(raw json.RawMessage) (any, error) {
	if e.relStore == nil {
		return nil, errors.New("relationship store not initialized")
	}
	var args struct {
		RelationshipID string `json:"relationship_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid delete_relationship args: %w", err)
	}
	if args.RelationshipID == "" {
		return nil, errors.New("relationship_id is required")
	}
	if err := e.relStore.Delete(args.RelationshipID); err != nil {
		return nil, fmt.Errorf("delete relationship: %w", err)
	}
	return map[string]any{"deleted": args.RelationshipID}, nil
}

func (e *ToolExecutor) semanticSearch(raw json.RawMessage) (any, error) {
	if e.ragService == nil {
		return nil, errors.New("semantic_search: RAG service not available (no OpenAI API key configured)")
	}
	var args struct {
		Query      string `json:"query"`
		Limit      int    `json:"limit"`
		WorkbookID string `json:"workbook_id,omitempty"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid semantic_search args: %w", err)
	}
	if args.Query == "" {
		return nil, errors.New("query is required")
	}
	if args.Limit <= 0 {
		args.Limit = 5
	}

	results, err := e.ragService.Search(context.Background(), args.Query, args.Limit)
	if err != nil {
		return nil, fmt.Errorf("semantic_search: %w", err)
	}

	// Filter by workbook if requested
	if args.WorkbookID != "" {
		filtered := results[:0]
		for _, r := range results {
			if r.WorkbookID == args.WorkbookID {
				filtered = append(filtered, r)
			}
		}
		results = filtered
	}

	return map[string]any{"results": results, "count": len(results)}, nil
}

func (e *ToolExecutor) saveNote(raw json.RawMessage) (any, error) {
	var args struct {
		Content    string   `json:"content"`
		Tags       []string `json:"tags"`
		WorkbookID string   `json:"workbook_id"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid save_note args: %w", err)
	}
	if args.Content == "" {
		return nil, fmt.Errorf("content is required")
	}
	ns := store.NewNoteStore(e.store.DB())
	note, err := ns.Create(store.CreateNoteRequest{
		Content:    args.Content,
		Tags:       args.Tags,
		Source:     "agent",
		WorkbookID: args.WorkbookID,
	})
	if err != nil {
		return nil, fmt.Errorf("save_note: %w", err)
	}
	return map[string]any{"id": note.ID, "content": note.Content, "tags": note.Tags}, nil
}

func (e *ToolExecutor) searchNotes(raw json.RawMessage) (any, error) {
	var args struct {
		Query string `json:"query"`
	}
	if err := json.Unmarshal(raw, &args); err != nil {
		return nil, fmt.Errorf("invalid search_notes args: %w", err)
	}
	ns := store.NewNoteStore(e.store.DB())
	notes, err := ns.List(args.Query)
	if err != nil {
		return nil, fmt.Errorf("search_notes: %w", err)
	}
	return notes, nil
}
