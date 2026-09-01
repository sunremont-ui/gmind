package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gmind/backend/internal/model"
	"github.com/go-chi/chi/v5"
)

// Двусторонняя работа с памятью MASys: до этого мост умел только читать и
// удалять. Здесь появляется запись — то, что человек сделал на холсте, попадает
// в память MASys, а из узла можно поставить задачу.
//
// Схемы входа взяты из E:\MASys\apps\server\src\router\{memory,runs}.ts.
// Напоминание: процедуры объявлены через z.object({...}) — объект обязателен
// даже при необязательных полях, поэтому пустую карту шлём как input={}.

// requireFields проверяет наличие непустых строковых полей во входе.
func requireFields(body map[string]any, fields ...string) string {
	for _, f := range fields {
		v, ok := body[f]
		if !ok || v == nil {
			return f + " required"
		}
		if s, isStr := v.(string); isStr && strings.TrimSpace(s) == "" {
			return f + " required"
		}
	}
	return ""
}

// MASysLogEpisode — POST /api/v1/masys/memory/episodes
// Body: { action, namespace?, agentId?, runId?, input?, output?, status?, tags?, duration? }
// Записывает эпизод: «что произошло» в эпизодической памяти.
func (h *Handler) MASysLogEpisode(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if msg := requireFields(body, "action"); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.episode.log", body)
	h.writeMASysJSON(w, data, err)
}

// MASysRemember — POST /api/v1/masys/memory/remember
// Body: { content, type?, namespace?, tags?, source?, title?, outcome?, force? }
// Контроллер памяти сам решает, в какой слой положить запись.
func (h *Handler) MASysRemember(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if msg := requireFields(body, "content"); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	if body["source"] == nil {
		// Источник помогает потом отличить ручную правку от машинной записи.
		body["source"] = "gmind-canvas"
	}
	data, err := h.callTRPCMutation(r.Context(), "memory.controller.remember", body)
	h.writeMASysJSON(w, data, err)
}

// MASysUpsertEntity — POST /api/v1/masys/memory/entities/upsert
// Body: { name, type, namespace?, description?, attributes?, incrementMentions? }
func (h *Handler) MASysUpsertEntity(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if msg := requireFields(body, "name", "type"); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	body["type"] = normalizeEntityType(body["type"])
	data, err := h.callTRPCMutation(r.Context(), "memory.entity.upsert", body)
	h.writeMASysJSON(w, data, err)
}

// MASysAddRelation — POST /api/v1/masys/memory/relations
// Body: { sourceName, sourceType, predicate, targetName, targetType, namespace? }
func (h *Handler) MASysAddRelation(w http.ResponseWriter, r *http.Request) {
	body, err := decodeBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if msg := requireFields(body, "sourceName", "predicate", "targetName"); msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return
	}
	body["sourceType"] = normalizeEntityType(body["sourceType"])
	body["targetType"] = normalizeEntityType(body["targetType"])
	data, err := h.callTRPCMutation(r.Context(), "memory.kg.addRelation", body)
	h.writeMASysJSON(w, data, err)
}

// entityTypeEnum в MASys: person | place | org | concept | custom.
// Виды памяти Gmind богаче (skill, episode, semantic…), поэтому сводим их к
// допустимому набору — иначе zod отклонит запись целиком.
func normalizeEntityType(v any) string {
	s, _ := v.(string)
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "person":
		return "person"
	case "place":
		return "place"
	case "org", "organization":
		return "org"
	case "concept", "semantic", "entity", "":
		return "concept"
	default:
		return "custom"
	}
}

// ─────────────────────── задачи: запуск работы в MASys ───────────────────────

type startRunRequest struct {
	PipelineID string         `json:"pipeline_id"`
	Inputs     map[string]any `json:"inputs,omitempty"`
	// TimeoutMS относится только к invoke (синхронный вызов с ожиданием).
	TimeoutMS int `json:"timeout_ms,omitempty"`
	// Wait=true → runs.invoke (ждём результат), иначе runs.start (сразу runId).
	Wait bool `json:"wait,omitempty"`
	// Привязка задачи к узлу карты — чтобы результат было видно там, где ставили.
	WorkbookID string `json:"workbook_id,omitempty"`
	TopicID    string `json:"topic_id,omitempty"`
}

// MASysStartRun — POST /api/v1/masys/runs/start
// Ставит задачу: запускает пайплайн MASys. Если указан узел карты, на нём
// сохраняется id прогона — на холсте видно, что работа поставлена.
func (h *Handler) MASysStartRun(w http.ResponseWriter, r *http.Request) {
	var req startRunRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if strings.TrimSpace(req.PipelineID) == "" {
		writeError(w, http.StatusBadRequest, "pipeline_id required")
		return
	}

	input := map[string]any{"pipelineId": req.PipelineID}
	method := "runs.start"
	if req.Wait {
		method = "runs.invoke"
		if len(req.Inputs) > 0 {
			input["inputs"] = req.Inputs
		}
		if req.TimeoutMS > 0 {
			input["timeoutMs"] = req.TimeoutMS
		}
	} else if len(req.Inputs) > 0 {
		// runs.start не принимает inputs — данные передаются только через invoke.
		method = "runs.invoke"
		input["inputs"] = req.Inputs
	}

	data, err := h.callTRPCMutation(r.Context(), method, input)
	if err != nil {
		writeError(w, http.StatusBadGateway, "MASys "+method+": "+err.Error())
		return
	}

	// Привязка к узлу: запоминаем runId, чтобы карта помнила поставленную задачу.
	if req.WorkbookID != "" && req.TopicID != "" {
		if runID := extractRunID(data); runID != "" {
			h.stampRunOnTopic(req.WorkbookID, req.TopicID, runID)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// MASysStopRun — POST /api/v1/masys/runs/{runID}/stop
func (h *Handler) MASysStopRun(w http.ResponseWriter, r *http.Request) {
	runID := chi.URLParam(r, "runID")
	if runID == "" {
		writeError(w, http.StatusBadRequest, "runID required")
		return
	}
	data, err := h.callTRPCMutation(r.Context(), "runs.stop", map[string]any{"runId": runID})
	h.writeMASysJSON(w, data, err)
}

// extractRunID достаёт runId из ответа runs.start/runs.invoke.
func extractRunID(data json.RawMessage) string {
	var resp struct {
		RunID string `json:"runId"`
		ID    string `json:"id"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return ""
	}
	if resp.RunID != "" {
		return resp.RunID
	}
	return resp.ID
}

// stampRunOnTopic сохраняет id прогона на узле. Ошибки не фатальны: задача уже
// запущена, и терять её из-за неудачной записи в карту нельзя.
func (h *Handler) stampRunOnTopic(workbookID, topicID, runID string) {
	if h.store == nil {
		return
	}
	wb, err := h.store.GetWorkbook(workbookID)
	if err != nil || wb == nil {
		return
	}
	for _, sheet := range wb.Sheets {
		found := false
		walkTopics(sheet.RootTopic, func(t *model.Topic) {
			if t.ID == topicID {
				t.MasysRunID = runID
				found = true
			}
		})
		for _, ft := range sheet.FloatingTopics {
			walkTopics(ft, func(t *model.Topic) {
				if t.ID == topicID {
					t.MasysRunID = runID
					found = true
				}
			})
		}
		if found {
			_ = h.store.UpdateWorkbook(wb)
			return
		}
	}
}
