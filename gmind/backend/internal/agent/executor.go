package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	"github.com/gmind/backend/internal/wiki"
)

// ToolExecutor executes tool calls against the store.
type ToolExecutor struct {
	store    *store.Store
	eventBus core.EventBus
	logger   core.Logger
	searcher Searcher
	wiki     *wiki.Store

	// workbookLocks prevents concurrent mutations to the same workbook.
	workbookLocks sync.Map // map[string]*sync.Mutex
}

func NewToolExecutor(s *store.Store, eventBus core.EventBus, logger core.Logger, wikiStore *wiki.Store) *ToolExecutor {
	return &ToolExecutor{
		store:    s,
		eventBus: eventBus,
		logger:   logger,
		searcher: NewDuckDuckGoSearcher(),
		wiki:     wikiStore,
	}
}

func (e *ToolExecutor) lockWorkbook(id string) *sync.Mutex {
	mu, _ := e.workbookLocks.LoadOrStore(id, &sync.Mutex{})
	return mu.(*sync.Mutex)
}

type callToolFn func(args json.RawMessage) (any, error)

func (e *ToolExecutor) getCallbacks() map[string]callToolFn {
	return map[string]callToolFn{
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
	}
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
