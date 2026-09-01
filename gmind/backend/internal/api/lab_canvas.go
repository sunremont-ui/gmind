package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
)

// Портфель на холсте: треки и их записи узлами.
//
// Дерево несёт иерархию (портфель → проект → вид → запись), а типизированные
// связи V5.0 рисуются ТОЛЬКО там, где отношение есть в данных: supersedesId,
// то есть «эта запись заменила ту». Дорисовать рёбра «гейт держит шаг» или
// «решение опирается на факт» было бы приятно и неправдиво — таких полей в
// записи нет, и связь пришлось бы выдумать.

// labEntryLite — то, что нужно карте от записи.
type labEntryLite struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"`
	Statement    string `json:"statement"`
	Body         string `json:"body"`
	Status       string `json:"status"`
	SupersedesID string `json:"supersedesId"`
	LastVerdict  string `json:"lastVerdict"`
	SourceRef    string `json:"sourceRef"`
	CreatedAt    string `json:"createdAt"`
}

// labKindGlyph — форма вида на холсте. Тот же набор, что в панели: узел должен
// читаться одинаково, где бы его ни встретили.
var labKindGlyph = map[string]string{
	"next": "▶", "gate": "▮", "decision": "◆", "tail": "◗", "fact": "●", "lesson": "✦",
}

var labKindTitle = map[string]string{
	"next": "Шаг", "gate": "Гейты", "decision": "Решения",
	"tail": "Хвосты", "fact": "Факты", "lesson": "Уроки",
}

// labKindOrder — от того, чем работа держится, к тому, что усвоено.
var labKindOrder = []string{"next", "gate", "decision", "tail", "fact", "lesson"}

type labCanvasRequest struct {
	// Path пуст — карта строится по всему реестру.
	Path string `json:"path"`
	// Limit — потолок записей на трек. Ноль означает значение по умолчанию.
	Limit int `json:"limit"`
	Title string `json:"title"`
}

// BuildLabCanvas — POST /api/v1/lab/canvas
func (h *Handler) BuildLabCanvas(w http.ResponseWriter, r *http.Request) {
	var req labCanvasRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if h.store == nil {
		writeError(w, http.StatusServiceUnavailable, "хранилище недоступно")
		return
	}
	limit := req.Limit
	if limit <= 0 {
		limit = 80
	}

	projects := []labProject{}
	if strings.TrimSpace(req.Path) != "" {
		dir := normalizeLabPath(req.Path)
		if h.labRegistry == nil || !h.labRegistry.allows(dir) {
			writeError(w, http.StatusForbidden, "каталог не в реестре лабы: "+dir)
			return
		}
		projects = append(projects, labProjectInfo(labRegistryEntry{Path: dir}))
	} else if h.labRegistry != nil {
		for _, e := range h.labRegistry.load() {
			projects = append(projects, labProjectInfo(e))
		}
	}
	if len(projects) == 0 {
		writeError(w, http.StatusBadRequest, "в реестре нет проектов — выкладывать нечего")
		return
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		if len(projects) == 1 {
			title = "Трек " + projects[0].Track + " · " + projects[0].Label
		} else {
			title = "Лаба · портфель"
		}
	}

	wb := model.NewWorkbook(title)
	sheet := model.NewSheet(title)
	root := sheet.RootTopic

	type pendingEdge struct{ fromID, toID, note string }
	var edges []pendingEdge
	stats := map[string]int{"projects": 0, "entries": 0, "truncated": 0}

	for _, p := range projects {
		projectNode := model.NewTopic(labProjectNodeTitle(p))
		projectNode.Notes = p.Path
		root.Children = append(root.Children, projectNode)
		stats["projects"]++

		if p.Track == "" {
			projectNode.Body = "у каталога нет читаемого lab.config.json: " + p.Error
			continue
		}

		entries, err := h.labEntries(r.Context(), p.Track, p.Namespace, limit)
		if err != nil {
			// Недоступный трек не отменяет остальные: узел говорит, что случилось.
			projectNode.Body = "трек недоступен: " + err.Error()
			continue
		}
		if len(entries) >= limit {
			stats["truncated"]++
		}

		byKind := map[string][]labEntryLite{}
		for _, e := range entries {
			byKind[e.Kind] = append(byKind[e.Kind], e)
		}
		// Узел записи по её id — иначе рёбра supersedes некуда крепить.
		nodeByEntry := map[string]string{}

		for _, kind := range labKindOrder {
			list := byKind[kind]
			if len(list) == 0 {
				continue
			}
			sort.Slice(list, func(i, j int) bool { return list[i].CreatedAt > list[j].CreatedAt })
			kindNode := model.NewTopic(fmt.Sprintf("%s %s · %d", labKindGlyph[kind], labKindTitle[kind], len(list)))
			projectNode.Children = append(projectNode.Children, kindNode)

			for _, e := range list {
				node := model.NewTopic(labEntryNodeTitle(e))
				node.Body = e.Body
				node.Notes = labEntryNotes(e)
				// Решение — единственный вид, у которого есть прямое соответствие
				// в видах памяти. Остальным вид не приписывается: выдуманное
				// соответствие исказило бы силуэт узла на карте.
				if e.Kind == "decision" {
					node.MemoryKind = "decision"
				}
				kindNode.Children = append(kindNode.Children, node)
				nodeByEntry[e.ID] = node.ID
				stats["entries"]++
				if e.Status == "superseded" || e.Status == "revoked" {
					stats["replaced"]++
				}
			}
		}

		for _, e := range entries {
			if e.SupersedesID == "" {
				continue
			}
			from, okFrom := nodeByEntry[e.ID]
			to, okTo := nodeByEntry[e.SupersedesID]
			// Заменённая запись могла не попасть в выборку — ребро в пустоту не рисуем.
			if okFrom && okTo {
				edges = append(edges, pendingEdge{fromID: from, toID: to, note: "supersedesId"})
			}
		}
	}

	wb.AddSheet(sheet)
	if err := h.store.CreateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	created := 0
	if h.relationships != nil {
		for _, e := range edges {
			rec := &store.RelationshipRecord{
				WorkbookID: wb.ID, FromSheetID: sheet.ID, ToSheetID: sheet.ID,
				FromTopicID: e.fromID, ToTopicID: e.toID,
				// custom, а не contradicts: запись не спорит с заменённой, она
				// встаёт на её место. Своего типа для этого в V5.0 нет, и брать
				// похожий по звучанию значило бы соврать типом.
				Type: "custom", Direction: "forward", Title: "заменяет",
				Style: "dashed", Notes: e.note, CreatedBy: "lab-canvas",
			}
			if err := h.relationships.Insert(rec); err != nil {
				// Молчаливый пропуск однажды уже спрятал то, что связей не
				// возникает вовсе: отказ должен быть виден в ответе.
				stats["relationship_errors"]++
			} else {
				created++
			}
		}
	}
	stats["relationships"] = created

	writeJSON(w, http.StatusCreated, map[string]any{"workbook": wb, "stats": stats})
}

// labEntries тянет записи трека из MASys.
//
// ⚠️ Статусы перечисляются явно. Без этого `memory.lab.list` отдаёт только
// живые записи (proposed и accepted), а заменённые не отдаёт вовсе — и ребро
// «заменяет» упиралось в узел, которого нет в выборке: связей выходило ноль
// при 22 записях с supersedesId. Отменённая запись и есть второй конец такого
// ребра; без неё история понимания на карте не видна.
func (h *Handler) labEntries(ctx context.Context, track, namespace string, limit int) ([]labEntryLite, error) {
	raw, err := h.callTRPCQuery(ctx, "memory.lab.list", map[string]any{
		"track": track, "namespace": namespace, "limit": limit,
		"statuses": []string{"accepted", "proposed", "superseded", "revoked"},
	})
	if err != nil {
		return nil, err
	}
	var entries []labEntryLite
	if err := json.Unmarshal(raw, &entries); err != nil {
		return nil, fmt.Errorf("разбор записей трека: %w", err)
	}
	return entries, nil
}

func labProjectNodeTitle(p labProject) string {
	if p.Track == "" {
		return p.Label
	}
	return p.Track + " · " + p.Label
}

// labEntryNodeTitle — заголовок узла записи.
//
// Длинное утверждение не режется: узел растёт под текст (модель «голова +
// тело»), а обрезанное утверждение на карте читалось бы как другое утверждение.
func labEntryNodeTitle(e labEntryLite) string {
	glyph := labKindGlyph[e.Kind]
	if glyph == "" {
		glyph = "•"
	}
	return glyph + " " + e.Statement
}

// labEntryNotes — служебная сторона записи: статус, вердикт, ссылка в git.
func labEntryNotes(e labEntryLite) string {
	parts := []string{"статус: " + e.Status}
	if e.LastVerdict != "" {
		parts = append(parts, "вердикт: "+e.LastVerdict)
	}
	if e.SourceRef != "" {
		parts = append(parts, e.SourceRef)
	}
	return strings.Join(parts, " · ")
}
