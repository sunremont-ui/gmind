package model

import "time"

type Workbook struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Sheets     []*Sheet  `json:"sheets"`
	Private    bool      `json:"private"`
	AccessMode string    `json:"access_mode,omitempty"`
	OwnerID    string    `json:"owner_id"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

const (
	AccessModePublic       = "public"
	AccessModePrivate      = "private"
	AccessModeAgents       = "agents"
	AccessModeCollaborators = "collaborators"
)

type AddCollaboratorRequest struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
}

type Sheet struct {
	ID             string          `json:"id"`
	Title          string          `json:"title"`
	RootTopic      *Topic          `json:"root_topic"`
	Relationships  []*Relationship `json:"relationships,omitempty"`
	FloatingTopics []*Topic        `json:"floating_topics,omitempty"`
	ImportedData   string          `json:"imported_data,omitempty"`
}

type Topic struct {
	ID             string    `json:"id"`
	Title          string    `json:"title"`
	Notes          string    `json:"notes,omitempty"`
	Markers        []string  `json:"markers,omitempty"`
	Labels         []string  `json:"labels,omitempty"`
	Hyperlink      string    `json:"hyperlink,omitempty"`
	Image          string    `json:"image,omitempty"`
	Folded         bool      `json:"folded"`
	Children       []*Topic  `json:"children,omitempty"`
	Position       *Position `json:"position,omitempty"`
	Structure      string    `json:"structure_class,omitempty"`
	BranchSide     string    `json:"branch_side,omitempty"`
	EdgeStyle      string    `json:"edge_style,omitempty"`
	EdgeDash       string    `json:"edge_dash,omitempty"`
	FontSize       int       `json:"font_size,omitempty"`
	FontColor      string    `json:"font_color,omitempty"`
	FontFamily     string    `json:"font_family,omitempty"`
	FontWeight     int       `json:"font_weight,omitempty"`
	TextAlign      string    `json:"text_align,omitempty"`
	NodeWidth      int       `json:"node_width,omitempty"`
	BorderWidth    int       `json:"border_width,omitempty"`
	Padding        int       `json:"padding,omitempty"`
	Opacity        float64   `json:"opacity,omitempty"`
	Shape          string    `json:"shape,omitempty"`
	Progress       int       `json:"progress,omitempty"`
	Priority       int       `json:"priority,omitempty"`
	NodeHeight     int       `json:"node_height,omitempty"`
	BorderColor    string    `json:"border_color,omitempty"`
	ConnColor      string    `json:"connection_color,omitempty"`
	ShadowType     string    `json:"shadow_type,omitempty"`
	NodeStyle      string    `json:"node_style,omitempty"`
	FoldIcon       string    `json:"fold_icon,omitempty"`
	ShowChildCount bool      `json:"show_child_count,omitempty"`
	Icon           string    `json:"icon,omitempty"`
	RichText       string    `json:"rich_text,omitempty"`
	LevelGap       int       `json:"level_gap,omitempty"`
	SiblingGap     int       `json:"sibling_gap,omitempty"`
}

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Relationship struct {
	ID     string `json:"id"`
	Title  string `json:"title,omitempty"`
	End1ID string `json:"end1_id"`
	End2ID string `json:"end2_id"`
}

type CreateWorkbookRequest struct {
	Title string `json:"title"`
	Blank bool   `json:"blank,omitempty"` // если true — не запускать AI auto-generate на фронтенде
}

// BatchCreateTopicItem — один элемент batch-запроса
type BatchCreateTopicItem struct {
	ParentID    string    `json:"parent_id"`
	Title       string    `json:"title"`
	Notes       string    `json:"notes,omitempty"`
	FontColor   string    `json:"font_color,omitempty"`
	FontSize    int       `json:"font_size,omitempty"`
	NodeWidth   int       `json:"node_width,omitempty"`
	BorderColor string    `json:"border_color,omitempty"`
	Shape       string    `json:"shape,omitempty"`
	Icon        string    `json:"icon,omitempty"`
	Position    *Position `json:"position,omitempty"`
}

// BatchCreateTopicsRequest — запрос на пакетное создание топиков
type BatchCreateTopicsRequest struct {
	Topics []BatchCreateTopicItem `json:"topics"`
}

type CreateSheetRequest struct {
	Title   string `json:"title"`
	TopicID string `json:"topic_id,omitempty"`
}

type CreateTopicRequest struct {
	Title       string    `json:"title"`
	ParentID    string    `json:"parent_id"`
	Position    *Position `json:"position,omitempty"`
	Notes       string    `json:"notes,omitempty"`
	FontColor   string    `json:"font_color,omitempty"`
	FontSize    int       `json:"font_size,omitempty"`
	NodeWidth   int       `json:"node_width,omitempty"`
	BorderColor string    `json:"border_color,omitempty"`
	Shape       string    `json:"shape,omitempty"`
	Icon        string    `json:"icon,omitempty"`
	FontFamily  string    `json:"font_family,omitempty"`
	FontWeight  int       `json:"font_weight,omitempty"`
}

type UpdateTopicRequest struct {
	Title          string    `json:"title,omitempty"`
	Notes          string    `json:"notes,omitempty"`
	Markers        []string  `json:"markers,omitempty"`
	Labels         []string  `json:"labels,omitempty"`
	Hyperlink      string    `json:"hyperlink,omitempty"`
	Image          string    `json:"image,omitempty"`
	Folded         *bool     `json:"folded,omitempty"`
	Position       *Position `json:"position,omitempty"`
	Structure      string    `json:"structure_class,omitempty"`
	BranchSide     string    `json:"branch_side,omitempty"`
	EdgeStyle      string    `json:"edge_style,omitempty"`
	EdgeDash       string    `json:"edge_dash,omitempty"`
	FontSize       int       `json:"font_size,omitempty"`
	FontColor      string    `json:"font_color,omitempty"`
	FontFamily     string    `json:"font_family,omitempty"`
	FontWeight     int       `json:"font_weight,omitempty"`
	TextAlign      string    `json:"text_align,omitempty"`
	NodeWidth      int       `json:"node_width,omitempty"`
	BorderWidth    int       `json:"border_width,omitempty"`
	Padding        int       `json:"padding,omitempty"`
	Opacity        float64   `json:"opacity,omitempty"`
	Shape          string    `json:"shape,omitempty"`
	Progress       int       `json:"progress,omitempty"`
	Priority       int       `json:"priority,omitempty"`
	NodeHeight     int       `json:"node_height,omitempty"`
	BorderColor    string    `json:"border_color,omitempty"`
	ConnColor      string    `json:"connection_color,omitempty"`
	ShadowType     string    `json:"shadow_type,omitempty"`
	NodeStyle      string    `json:"node_style,omitempty"`
	FoldIcon       string    `json:"fold_icon,omitempty"`
	ShowChildCount *bool     `json:"show_child_count,omitempty"`
	Icon           string    `json:"icon,omitempty"`
	RichText       string    `json:"rich_text,omitempty"`
	LevelGap       int       `json:"level_gap,omitempty"`
	SiblingGap     int       `json:"sibling_gap,omitempty"`
}

type CreateRelationshipRequest struct {
	Title  string `json:"title,omitempty"`
	End1ID string `json:"end1_id"`
	End2ID string `json:"end2_id"`
}

type MoveTopicRequest struct {
	NewParentID string `json:"new_parent_id"`
	Index       int    `json:"index"`
}

type CopyTopicToWorkbookRequest struct {
	TargetWorkbookID string `json:"target_workbook_id"`
	TargetParentID   string `json:"target_parent_id,omitempty"`
}

type AIGenerateRequest struct {
	Prompt     string `json:"prompt"`
	WorkbookID string `json:"workbook_id"`
	SheetID    string `json:"sheet_id"`
	ParentID   string `json:"parent_id,omitempty"`
}

type AIChatRequest struct {
	WorkbookID string `json:"workbook_id"`
	SheetID    string `json:"sheet_id"`
	Message    string `json:"message"`
}

type AIChatResponse struct {
	Message     string         `json:"message"`
	Suggestions []AISuggestion `json:"suggestions,omitempty"`
}

type AISuggestion struct {
	Action  string `json:"action"` // "add_topic", "expand", "restructure"
	TopicID string `json:"topic_id,omitempty"`
	Title   string `json:"title,omitempty"`
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
	UserID  string      `json:"user_id"`
}

type SwitchAIProviderRequest struct {
	Provider string `json:"provider"` // "openai", "local", or "yandex"
	Endpoint string `json:"endpoint,omitempty"`
	Model    string `json:"model,omitempty"`
	APIKey   string `json:"api_key,omitempty"`
	FolderID string `json:"folder_id,omitempty"`
}

type ErrorCode string

const (
	ErrInvalidRequest     ErrorCode = "INVALID_REQUEST"
	ErrNotFound           ErrorCode = "NOT_FOUND"
	ErrConflict           ErrorCode = "CONFLICT"
	ErrInternal           ErrorCode = "INTERNAL_ERROR"
	ErrServiceUnavailable ErrorCode = "SERVICE_UNAVAILABLE"
	ErrValidation         ErrorCode = "VALIDATION_ERROR"
)

type ErrorResponse struct {
	Error  string    `json:"error"`
	Code   ErrorCode `json:"code"`
	Status int       `json:"status"`
}

func NewErrorResponse(code ErrorCode, status int, msg string) ErrorResponse {
	return ErrorResponse{Error: msg, Code: code, Status: status}
}
