package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
)

// newUpsertRouter поднимает роутер и создаёт карту через API — с настоящим
// листом и корневым узлом, как у пользователя.
func newUpsertRouter(t *testing.T) (http.Handler, *store.Store, *model.Workbook) {
	t.Helper()
	s, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })

	h := New(s, nil, "", nil, nil)
	router := h.Router(&config.Config{AllowedOrigins: []string{"*"}, FilesPath: t.TempDir()})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Записная книжка мастера"}))
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("создание карты: status = %d, body = %s", w.Code, w.Body.String())
	}
	var wb model.Workbook
	if err := json.Unmarshal(w.Body.Bytes(), &wb); err != nil {
		t.Fatalf("decode workbook: %v (%s)", err, w.Body.String())
	}
	return router, s, &wb
}

func upsert(t *testing.T, router http.Handler, workbookID string, body any) UpsertTopicsResponse {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest("POST", "/api/v1/workbooks/"+workbookID+"/topics/upsert", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var resp UpsertTopicsResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v (%s)", err, w.Body.String())
	}
	return resp
}

func noteInput(key, title, body string) map[string]any {
	return map[string]any{
		"external_key": key,
		"title":        title,
		"body":         body,
		"memory_kind":  "episodic",
	}
}

// Повторная доставка того же события не должна плодить узлы — это главное
// требование к синхронизации: воркер источника ретраит при любой ошибке сети.
func TestUpsertIsIdempotentByExternalKey(t *testing.T) {
	router, s, wb := newUpsertRouter(t)

	first := upsert(t, router, wb.ID, map[string]any{
		"topics": []any{noteInput("note:N-20260804-A2B282", "Холодильник Bosch", "не морозит нижняя камера")},
	})
	if first.Created != 1 || first.Updated != 0 {
		t.Fatalf("первый синк: created=%d updated=%d", first.Created, first.Updated)
	}

	second := upsert(t, router, wb.ID, map[string]any{
		"topics": []any{noteInput("note:N-20260804-A2B282", "Холодильник Bosch", "не морозит нижняя камера, компрессор горячий")},
	})
	if second.Created != 0 || second.Updated != 1 {
		t.Fatalf("второй синк: created=%d updated=%d", second.Created, second.Updated)
	}
	if second.Results[0].ID != first.Results[0].ID {
		t.Fatalf("id разъехались: %s vs %s", first.Results[0].ID, second.Results[0].ID)
	}

	saved, err := s.GetWorkbook(wb.ID)
	if err != nil {
		t.Fatal(err)
	}
	root := saved.Sheets[0].RootTopic
	if len(root.Children) != 1 {
		t.Fatalf("детей у корня: %d, ожидался 1", len(root.Children))
	}
	if got := root.Children[0].Body; got != "не морозит нижняя камера, компрессор горячий" {
		t.Fatalf("тело не обновилось: %q", got)
	}
	if root.Children[0].MemoryKind != "episodic" {
		t.Fatalf("memory_kind = %q", root.Children[0].MemoryKind)
	}
}

// Ключ вычисляется одинаково на обеих сторонах: источник может знать id узла
// заранее, не спрашивая карту.
func TestTopicIDForExternalKeyIsStable(t *testing.T) {
	a := TopicIDForExternalKey("note:N-20260804-A2B282")
	b := TopicIDForExternalKey("  note:N-20260804-A2B282  ")
	if a != b {
		t.Fatalf("пробелы поменяли id: %s vs %s", a, b)
	}
	if a == TopicIDForExternalKey("note:N-20260804-A2B283") {
		t.Fatal("разные ключи дали один id")
	}
}

// Человек перетащил запись в другую ветку — синхронизация не имеет права
// вернуть её на место: структура карты за человеком.
func TestUpsertDoesNotReparentExistingTopic(t *testing.T) {
	router, s, wb := newUpsertRouter(t)

	// Ветка, куда пользователь перенесёт запись.
	branchResp := upsert(t, router, wb.ID, map[string]any{
		"topics": []any{map[string]any{"external_key": "branch:bosch", "title": "Bosch"}},
	})
	branchID := branchResp.Results[0].ID

	created := upsert(t, router, wb.ID, map[string]any{
		"topics": []any{noteInput("note:N-1", "Запись", "текст")},
	})
	noteID := created.Results[0].ID

	// Переносим запись под ветку — как это сделал бы человек на холсте.
	moveReq := httptest.NewRequest("POST", "/api/v1/workbooks/"+wb.ID+"/topics/"+noteID+"/move", bytes.NewReader(
		[]byte(`{"new_parent_id":"`+branchID+`"}`)))
	moveReq.Header.Set("Content-Type", "application/json")
	mw := httptest.NewRecorder()
	router.ServeHTTP(mw, moveReq)
	if mw.Code != http.StatusOK {
		t.Fatalf("move: status = %d, body = %s", mw.Code, mw.Body.String())
	}

	// Следующий синк идёт с parent_id = корень, но узел должен остаться в ветке.
	upsert(t, router, wb.ID, map[string]any{
		"topics": []any{noteInput("note:N-1", "Запись", "текст обновлён")},
	})

	saved, err := s.GetWorkbook(wb.ID)
	if err != nil {
		t.Fatal(err)
	}
	branch := saved.Sheets[0].FindTopic(branchID)
	if branch == nil || len(branch.Children) != 1 || branch.Children[0].ID != noteID {
		t.Fatalf("запись уехала из ветки: %+v", branch)
	}
	if branch.Children[0].Body != "текст обновлён" {
		t.Fatalf("тело не обновилось: %q", branch.Children[0].Body)
	}
	for _, child := range saved.Sheets[0].RootTopic.Children {
		if child.ID == noteID {
			t.Fatal("запись продублирована под корнем")
		}
	}
}

// Заметки — место человека. Синхронизация трогает их только по явному указанию,
// иначе замечания мастера стирались бы каждым повторным синком.
func TestUpsertKeepsHumanNotesUnlessProvided(t *testing.T) {
	router, s, wb := newUpsertRouter(t)

	res := upsert(t, router, wb.ID, map[string]any{
		"topics": []any{noteInput("note:N-2", "Запись", "текст")},
	})
	noteID := res.Results[0].ID

	putReq := httptest.NewRequest("PUT", "/api/v1/workbooks/"+wb.ID+"/topics/"+noteID, bytes.NewReader(
		[]byte(`{"notes":"перезвонить в четверг"}`)))
	putReq.Header.Set("Content-Type", "application/json")
	pw := httptest.NewRecorder()
	router.ServeHTTP(pw, putReq)
	if pw.Code != http.StatusOK {
		t.Fatalf("put: status = %d, body = %s", pw.Code, pw.Body.String())
	}

	upsert(t, router, wb.ID, map[string]any{
		"topics": []any{noteInput("note:N-2", "Запись", "текст обновлён")},
	})

	saved, err := s.GetWorkbook(wb.ID)
	if err != nil {
		t.Fatal(err)
	}
	topic := saved.Sheets[0].FindTopic(noteID)
	if topic.Notes != "перезвонить в четверг" {
		t.Fatalf("заметка человека затёрта: %q", topic.Notes)
	}
}

// Разбор записи (речь / на снимке / OCR) — дети. Свой ключ им не нужен:
// он выводится из ключа родителя, поэтому тоже устойчив к повторам.
func TestUpsertChildrenInheritKeyAndStayStable(t *testing.T) {
	router, s, wb := newUpsertRouter(t)

	payload := map[string]any{
		"topics": []any{map[string]any{
			"external_key": "note:N-3",
			"title":        "Запись",
			"body":         "склеенный текст",
			"children": []any{
				map[string]any{"title": "Речь", "body": "расшифровка"},
				map[string]any{"title": "На снимке", "body": "E-Nr: SN636X01KE"},
			},
		}},
	}
	first := upsert(t, router, wb.ID, payload)
	if first.Created != 3 {
		t.Fatalf("создано узлов: %d, ожидалось 3", first.Created)
	}
	if key := first.Results[0].Children[0].ExternalKey; key != "note:N-3/Речь" {
		t.Fatalf("ключ ребёнка = %q", key)
	}

	second := upsert(t, router, wb.ID, payload)
	if second.Created != 0 || second.Updated != 3 {
		t.Fatalf("повтор: created=%d updated=%d", second.Created, second.Updated)
	}

	saved, err := s.GetWorkbook(wb.ID)
	if err != nil {
		t.Fatal(err)
	}
	note := saved.Sheets[0].FindTopic(first.Results[0].ID)
	if len(note.Children) != 2 {
		t.Fatalf("детей у записи: %d", len(note.Children))
	}
}

// Payload приходит извне, поэтому слишком глубокое дерево должно быть отбито,
// а не уронить сервер рекурсией.
func TestUpsertRejectsTooDeepTree(t *testing.T) {
	router, _, wb := newUpsertRouter(t)

	node := map[string]any{"external_key": "deep:leaf", "title": "лист"}
	for i := 0; i < maxUpsertDepth+1; i++ {
		node = map[string]any{"title": "уровень", "children": []any{node}}
	}
	node["external_key"] = "deep:root"

	raw, _ := json.Marshal(map[string]any{"topics": []any{node}})
	req := httptest.NewRequest("POST", "/api/v1/workbooks/"+wb.ID+"/topics/upsert", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}

func TestUpsertRejectsTopicWithoutKey(t *testing.T) {
	router, _, wb := newUpsertRouter(t)

	raw, _ := json.Marshal(map[string]any{"topics": []any{map[string]any{"title": "Без ключа"}}})
	req := httptest.NewRequest("POST", "/api/v1/workbooks/"+wb.ID+"/topics/upsert", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
}
