package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
)

// Обратная сторона KG-sync: ручная доработка на холсте возвращается в память
// MASys. Раньше мост был односторонним (MASys → Gmind), поэтому всё, что человек
// правил визуально, оставалось только в Gmind.
//
// Что уходит в MASys:
//   узел с memory_kind        → memory.entity.upsert
//   связь V5.0 между узлами   → memory.kg.addRelation
//
// Идентичность — по MasysRef.Key, а не по заголовку: переименование узла в
// Gmind не создаёт в MASys дубль. После успешной записи ref проставляется на
// узел, поэтому повторный push идемпотентен.

// PushRequest — тело POST /api/v1/masys/push
type PushRequest struct {
	WorkbookID string `json:"workbook_id"`
	SheetID    string `json:"sheet_id,omitempty"`
	Namespace  string `json:"namespace,omitempty"`
	// TopicIDs — если задано, отправляем только эти узлы (выделение на холсте).
	TopicIDs []string `json:"topic_ids,omitempty"`
	// IncludeRelations=false отправит только сущности, без связей.
	IncludeRelations *bool `json:"include_relations,omitempty"`
}

// PushResponse — отчёт о том, что реально ушло в память.
type PushResponse struct {
	Namespace       string   `json:"namespace"`
	EntitiesPushed  int      `json:"entities_pushed"`
	RelationsPushed int      `json:"relations_pushed"`
	Skipped         int      `json:"skipped"`
	Errors          []string `json:"errors,omitempty"`
	// Refs — какие узлы получили привязку к записи MASys.
	Refs map[string]string `json:"refs"`
}

// MASysPush — POST /api/v1/masys/push
func (h *Handler) MASysPush(w http.ResponseWriter, r *http.Request) {
	if h.store == nil {
		writeError(w, http.StatusServiceUnavailable, "store not initialized")
		return
	}
	var req PushRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.WorkbookID == "" {
		writeError(w, http.StatusBadRequest, "workbook_id required")
		return
	}
	if req.Namespace == "" {
		req.Namespace = "default"
	}
	withRelations := req.IncludeRelations == nil || *req.IncludeRelations

	wb, err := h.store.GetWorkbook(req.WorkbookID)
	if err != nil {
		internalError(w, err)
		return
	}
	if wb == nil {
		writeError(w, http.StatusNotFound, "workbook not found")
		return
	}
	sheet := wb.Sheets[0]
	if req.SheetID != "" {
		if s := wb.GetSheet(req.SheetID); s != nil {
			sheet = s
		}
	}
	if sheet == nil || sheet.RootTopic == nil {
		writeError(w, http.StatusBadRequest, "sheet has no root topic")
		return
	}

	only := map[string]bool{}
	for _, id := range req.TopicIDs {
		only[id] = true
	}

	// 1. Собираем узлы-кандидаты: только типизированные (с memory_kind).
	// Нетипизированный узел — это обычный элемент карты, ему в графе знаний не место.
	type candidate struct {
		topic *model.Topic
		key   string
		kind  string
	}
	var candidates []candidate
	skipped := 0

	collect := func(root *model.Topic) {
		walkTopics(root, func(t *model.Topic) {
			if len(only) > 0 && !only[t.ID] {
				return
			}
			kind := strings.TrimSpace(t.MemoryKind)
			if kind == "" {
				skipped++
				return
			}
			// Ключ — уже существующий ref (устойчив к переименованию) или заголовок.
			key := strings.TrimSpace(t.Title)
			if t.MasysRef != nil && t.MasysRef.Key != "" {
				key = t.MasysRef.Key
			}
			if key == "" {
				skipped++
				return
			}
			candidates = append(candidates, candidate{topic: t, key: key, kind: kind})
		})
	}
	collect(sheet.RootTopic)
	for _, ft := range sheet.FloatingTopics {
		collect(ft)
	}

	resp := PushResponse{Namespace: req.Namespace, Skipped: skipped, Refs: map[string]string{}}
	// byTopicID нужен для связей: по id узла достаём его имя и тип в MASys.
	byTopicID := map[string]candidate{}

	// 2. Сущности.
	for _, c := range candidates {
		input := map[string]any{
			"name":      c.key,
			"type":      normalizeEntityType(c.kind),
			"namespace": req.Namespace,
		}
		// Тело узла — осмысленное описание сущности; заметка идёт следом.
		if desc := describeTopic(c.topic); desc != "" {
			input["description"] = desc
		}
		// Исходный вид памяти Gmind сохраняем в атрибутах: MASys сузил бы его
		// до concept/custom, а мы не хотим терять точность при обратном чтении.
		input["attributes"] = map[string]any{
			"gmind_memory_kind": c.kind,
			"gmind_topic_id":    c.topic.ID,
		}

		if _, err := h.callTRPCMutation(r.Context(), "memory.entity.upsert", input); err != nil {
			resp.Errors = append(resp.Errors, c.key+": "+err.Error())
			continue
		}
		resp.EntitiesPushed++
		byTopicID[c.topic.ID] = c
		resp.Refs[c.topic.ID] = c.key
		// Привязываем узел к записи — повторный push не создаст дубль.
		c.topic.MasysRef = &model.MasysRef{Namespace: req.Namespace, Kind: c.kind, Key: c.key}
	}

	// 3. Связи между отправленными узлами.
	if withRelations && h.relationships != nil {
		rels, err := h.relationships.ListByWorkbook(req.WorkbookID)
		if err != nil {
			resp.Errors = append(resp.Errors, "relations: "+err.Error())
		} else {
			for _, rel := range rels {
				from, okFrom := byTopicID[rel.FromTopicID]
				to, okTo := byTopicID[rel.ToTopicID]
				if !okFrom || !okTo {
					continue // один из концов не ушёл в память — связь бессмысленна
				}
				input := map[string]any{
					"sourceName": from.key,
					"sourceType": normalizeEntityType(from.kind),
					"predicate":  predicateOf(rel),
					"targetName": to.key,
					"targetType": normalizeEntityType(to.kind),
					"namespace":  req.Namespace,
				}
				if _, err := h.callTRPCMutation(r.Context(), "memory.kg.addRelation", input); err != nil {
					resp.Errors = append(resp.Errors, from.key+"→"+to.key+": "+err.Error())
					continue
				}
				resp.RelationsPushed++
			}
		}
	}

	// 4. Сохраняем проставленные refs.
	if resp.EntitiesPushed > 0 {
		if err := h.store.UpdateWorkbook(wb); err != nil {
			resp.Errors = append(resp.Errors, "save refs: "+err.Error())
		}
	}

	writeJSON(w, http.StatusOK, resp)
}

// describeTopic собирает описание сущности из тела и заметки узла.
func describeTopic(t *model.Topic) string {
	parts := make([]string, 0, 2)
	if s := strings.TrimSpace(t.Body); s != "" {
		parts = append(parts, s)
	}
	if s := strings.TrimSpace(t.Notes); s != "" {
		parts = append(parts, s)
	}
	return strings.Join(parts, "\n\n")
}

// predicateOf — предикат для MASys: заголовок связи, иначе её тип.
// Обратное отображение к mapPredicateToType из masys_kg_sync.go.
func predicateOf(rel *store.RelationshipRecord) string {
	if s := strings.TrimSpace(rel.Title); s != "" {
		return s
	}
	if s := strings.TrimSpace(rel.Type); s != "" {
		return s
	}
	return "relates_to"
}
