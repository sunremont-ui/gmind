package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
)

// Приём записей из внешней системы (сейчас — записная книжка мастера в
// projectService, дальше через пайплайн MASys). Узел опознаётся по устойчивому
// внешнему ключу, а не по заголовку: ключ → UUIDv5 → id узла. Поэтому повторная
// доставка того же события обновляет тот же узел, а не плодит дубли, и хранить
// таблицу соответствий «запись ↔ топик» на стороне источника не нужно.
//
// Разделение ответственности, из которого выведено поведение ниже:
//   содержимое записи — за источником (title/body перезаписываются),
//   структура и пометки человека — за картой.
// Поэтому существующий узел НЕ переносится под parent_id (перетащили в другую
// ветку — там и останется), а notes/labels трогаются только если явно переданы:
// в notes человек пишет свои замечания, и синхронизация не имеет права их стереть.

// externalKeyNamespace — фиксированное пространство имён для UUIDv5. Менять
// нельзя: от него зависят id всех уже созданных узлов.
var externalKeyNamespace = uuid.MustParse("9f2b7c1a-5d34-4e88-b0a6-3c7d2e4f1a90")

// TopicIDForExternalKey — детерминированный id узла для внешнего ключа.
// Источник может вычислить его сам и не спрашивать карту.
func TopicIDForExternalKey(key string) string {
	return uuid.NewSHA1(externalKeyNamespace, []byte(strings.TrimSpace(key))).String()
}

// UpsertTopicInput — одна внешняя запись. Указатели у текстовых полей значат
// «поле передано»: пустая строка чистит значение, отсутствие ключа не трогает.
type UpsertTopicInput struct {
	ExternalKey string `json:"external_key,omitempty"`
	// ID — готовый id узла, если источник посчитал UUIDv5 сам.
	ID         string   `json:"id,omitempty"`
	Title      string   `json:"title"`
	Body       *string  `json:"body,omitempty"`
	Notes      *string  `json:"notes,omitempty"`
	Hyperlink  *string  `json:"hyperlink,omitempty"`
	Image      *string  `json:"image,omitempty"`
	MemoryKind string   `json:"memory_kind,omitempty"`
	Icon       string   `json:"icon,omitempty"`
	Shape      string   `json:"shape,omitempty"`
	FontColor  string   `json:"font_color,omitempty"`
	NodeWidth  int      `json:"node_width,omitempty"`
	Labels     []string `json:"labels,omitempty"`
	// Children — разбор записи (речь / что на снимке / OCR). Ключ ребёнка,
	// если не задан, выводится из ключа родителя и заголовка, поэтому остаётся
	// прежним от синка к синку.
	Children []UpsertTopicInput `json:"children,omitempty"`
}

// UpsertTopicsRequest — тело POST /api/v1/workbooks/{workbookID}/topics/upsert
type UpsertTopicsRequest struct {
	SheetID string `json:"sheet_id,omitempty"`
	// ParentID — куда класть новые узлы. Пусто → корень листа.
	ParentID string             `json:"parent_id,omitempty"`
	Topics   []UpsertTopicInput `json:"topics"`
}

// UpsertTopicResult — что стало с одной записью.
type UpsertTopicResult struct {
	ExternalKey string              `json:"external_key,omitempty"`
	ID          string              `json:"id"`
	Created     bool                `json:"created"`
	Children    []UpsertTopicResult `json:"children,omitempty"`
}

// UpsertTopicsResponse — отчёт синхронизации.
type UpsertTopicsResponse struct {
	WorkbookID string              `json:"workbook_id"`
	SheetID    string              `json:"sheet_id"`
	Created    int                 `json:"created"`
	Updated    int                 `json:"updated"`
	Results    []UpsertTopicResult `json:"results"`
}

// UpsertTopics — POST /api/v1/workbooks/{workbookID}/topics/upsert
func (h *Handler) UpsertTopics(w http.ResponseWriter, r *http.Request) {
	workbookID := chi.URLParam(r, "workbookID")
	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}

	var req UpsertTopicsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.Topics) == 0 {
		writeError(w, http.StatusBadRequest, "topics required")
		return
	}

	sheet := wb.Sheets[0]
	if req.SheetID != "" {
		s := wb.GetSheet(req.SheetID)
		if s == nil {
			writeError(w, http.StatusNotFound, "sheet not found")
			return
		}
		sheet = s
	}
	if sheet == nil || sheet.RootTopic == nil {
		writeError(w, http.StatusBadRequest, "sheet has no root topic")
		return
	}

	parent := sheet.RootTopic
	if req.ParentID != "" {
		p := sheet.FindTopic(req.ParentID)
		if p == nil {
			writeError(w, http.StatusNotFound, "parent topic not found")
			return
		}
		parent = p
	}

	resp := UpsertTopicsResponse{WorkbookID: wb.ID, SheetID: sheet.ID}
	for _, in := range req.Topics {
		res, err := h.upsertOne(wb, parent, in, "", 0, &resp)
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		resp.Results = append(resp.Results, res)
	}

	if err := h.store.UpdateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	if h.webhooks != nil {
		h.webhooks.Notify("topic.upserted", map[string]any{
			"workbook_id": wb.ID,
			"sheet_id":    sheet.ID,
			"created":     resp.Created,
			"updated":     resp.Updated,
		})
	}

	writeJSON(w, http.StatusOK, resp)
}

// upsertOne применяет одну запись и рекурсивно — её разбор.
func (h *Handler) upsertOne(
	wb *model.Workbook,
	parent *model.Topic,
	in UpsertTopicInput,
	parentKey string,
	depth int,
	resp *UpsertTopicsResponse,
) (UpsertTopicResult, error) {
	// Вход приходит из чужой системы: глубина ограничена, чтобы кривой payload
	// не увёл рекурсию в стек.
	if depth > maxUpsertDepth {
		return UpsertTopicResult{}, errTooDeep
	}
	key := strings.TrimSpace(in.ExternalKey)
	if key == "" && parentKey != "" && strings.TrimSpace(in.Title) != "" {
		// Ребёнок без своего ключа наследует его от родителя: «ключ/Речь».
		key = parentKey + "/" + strings.TrimSpace(in.Title)
	}

	id := strings.TrimSpace(in.ID)
	switch {
	case id != "":
		if _, err := uuid.Parse(id); err != nil {
			return UpsertTopicResult{}, errInvalidTopicID
		}
	case key != "":
		id = TopicIDForExternalKey(key)
	default:
		return UpsertTopicResult{}, errNoExternalKey
	}

	// Ищем по всей карте, а не только в целевом листе: узел могли перенести.
	topic := findTopicInWorkbook(wb, id)
	created := false
	if topic == nil {
		topic = model.NewTopicWithID(id, in.Title)
		parent.AddChild(topic)
		created = true
		resp.Created++
	} else {
		resp.Updated++
	}
	applyUpsertFields(topic, in)

	res := UpsertTopicResult{ExternalKey: key, ID: id, Created: created}
	for _, child := range in.Children {
		childRes, err := h.upsertOne(wb, topic, child, key, depth+1, resp)
		if err != nil {
			return UpsertTopicResult{}, err
		}
		res.Children = append(res.Children, childRes)
	}
	return res, nil
}

// applyUpsertFields переносит содержимое записи на узел. Оформление и раскладку
// (позиция, ветка, стиль) не трогаем — это работа человека на карте.
func applyUpsertFields(t *model.Topic, in UpsertTopicInput) {
	if s := strings.TrimSpace(in.Title); s != "" {
		t.Title = in.Title
	}
	if in.Body != nil {
		t.Body = *in.Body
	}
	if in.Notes != nil {
		t.Notes = *in.Notes
	}
	if in.Hyperlink != nil {
		t.Hyperlink = *in.Hyperlink
	}
	if in.Image != nil {
		t.Image = *in.Image
	}
	if in.MemoryKind != "" {
		t.MemoryKind = in.MemoryKind
	}
	if in.Icon != "" {
		t.Icon = in.Icon
	}
	if in.Shape != "" {
		t.Shape = in.Shape
	}
	if in.FontColor != "" {
		t.FontColor = in.FontColor
	}
	if in.NodeWidth > 0 {
		t.NodeWidth = in.NodeWidth
	}
	if in.Labels != nil {
		t.Labels = in.Labels
	}
}

// findTopicInWorkbook ищет узел по id во всех листах карты.
func findTopicInWorkbook(wb *model.Workbook, id string) *model.Topic {
	for _, sheet := range wb.Sheets {
		if t := sheet.FindTopic(id); t != nil {
			return t
		}
	}
	return nil
}

type upsertError string

func (e upsertError) Error() string { return string(e) }

// maxUpsertDepth — предел вложенности разбора записи. Реальный разбор — один
// уровень (Речь / На снимке / OCR), запас взят с большим избытком.
const maxUpsertDepth = 8

const (
	errInvalidTopicID = upsertError("invalid topic id: must be a UUID")
	errNoExternalKey  = upsertError("external_key or id required")
	errTooDeep        = upsertError("topic tree is too deep")
)
