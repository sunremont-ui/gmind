package api

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
)

// fakeMASysCall — что именно ушло в MASys: метод tRPC и распакованный input.
type fakeMASysCall struct {
	Method string
	Input  map[string]any
}

// fakeMASysServer подменяет MASys: отвечает на /health и записывает вызовы
// /trpc/<method>, чтобы тест мог проверить не только код ответа, но и то, что
// прокси действительно послал в память.
type fakeMASysServer struct {
	srv   *httptest.Server
	mu    sync.Mutex
	calls []fakeMASysCall
	// reply — что вернуть на мутацию (по умолчанию {"ok":true}).
	reply string
	// failMethod — этот метод отвечает ошибкой.
	failMethod string
}

func newFakeMASys(t *testing.T) *fakeMASysServer {
	t.Helper()
	f := &fakeMASysServer{reply: `{"ok":true}`}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"ok"}`))
			return
		}
		method := strings.TrimPrefix(r.URL.Path, "/trpc/")
		input := map[string]any{}
		if body, _ := io.ReadAll(r.Body); len(body) > 0 {
			_ = json.Unmarshal(body, &input)
		}
		if q := r.URL.Query().Get("input"); q != "" {
			_ = json.Unmarshal([]byte(q), &input)
		}

		f.mu.Lock()
		f.calls = append(f.calls, fakeMASysCall{Method: method, Input: input})
		fail := f.failMethod == method
		reply := f.reply
		f.mu.Unlock()

		if fail {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"error":{"message":"нарочная ошибка"}}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"result":{"data":` + reply + `}}`))
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeMASysServer) callsTo(method string) []fakeMASysCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []fakeMASysCall
	for _, c := range f.calls {
		if c.Method == method {
			out = append(out, c)
		}
	}
	return out
}

// newMASysWriteRouter поднимает роутер, для которого MASys — это fake-сервер.
func newMASysWriteRouter(t *testing.T) (http.Handler, *store.Store, *fakeMASysServer) {
	t.Helper()
	fake := newFakeMASys(t)

	// Автопоиск не должен уйти на реальный localhost:5010.
	prev := MASysCandidates
	MASysCandidates = []string{fake.srv.URL}
	t.Cleanup(func() { MASysCandidates = prev })

	s, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })

	h := New(s, nil, "", nil, nil)
	cfg := &config.Config{
		AllowedOrigins:  []string{"*"},
		MASysBaseURL:    fake.srv.URL,
		MarkdownPath:    t.TempDir(),
		MASysConfigPath: t.TempDir() + "/masys.json",
	}
	return h.Router(cfg), s, fake
}

func TestLogEpisodeRequiresAction(t *testing.T) {
	router, _, _ := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/memory/episodes", map[string]any{}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestLogEpisodeProxiesToMASys(t *testing.T) {
	router, _, fake := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/memory/episodes", map[string]any{
		"action":    "Ручная правка",
		"namespace": "lab",
		"status":    "success",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	calls := fake.callsTo("memory.episode.log")
	if len(calls) != 1 {
		t.Fatalf("вызовов memory.episode.log = %d, want 1", len(calls))
	}
	if calls[0].Input["action"] != "Ручная правка" || calls[0].Input["namespace"] != "lab" {
		t.Fatalf("input = %+v", calls[0].Input)
	}
}

func TestRememberAddsSourceByDefault(t *testing.T) {
	router, _, fake := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/memory/remember", map[string]any{
		"content": "что-то важное",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	calls := fake.callsTo("memory.controller.remember")
	if len(calls) != 1 {
		t.Fatalf("вызовов = %d", len(calls))
	}
	// Источник нужен, чтобы отличить ручную запись от машинной.
	if calls[0].Input["source"] != "gmind-canvas" {
		t.Fatalf("source = %v, want gmind-canvas", calls[0].Input["source"])
	}
}

func TestRememberRequiresContent(t *testing.T) {
	router, _, _ := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/memory/remember", map[string]any{"content": "  "}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestUpsertEntityNormalizesType(t *testing.T) {
	router, _, fake := newMASysWriteRouter(t)

	// Виды памяти Gmind богаче enum MASys — их надо свести, иначе zod отклонит.
	cases := map[string]string{
		"semantic": "concept",
		"person":   "person",
		"skill":    "custom",
		"episodic": "custom",
		"ORG":      "org",
		"concept":  "concept",
	}
	for kind, want := range cases {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/memory/entities/upsert", map[string]any{
			"name": "Узел-" + kind,
			"type": kind,
		}))
		if w.Code != http.StatusOK {
			t.Fatalf("%s: status = %d, body = %s", kind, w.Code, w.Body.String())
		}
		calls := fake.callsTo("memory.entity.upsert")
		last := calls[len(calls)-1]
		if last.Input["type"] != want {
			t.Fatalf("kind %q → type %v, want %q", kind, last.Input["type"], want)
		}
	}
}

func TestAddRelationRequiresEnds(t *testing.T) {
	router, _, _ := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/memory/relations", map[string]any{
		"sourceName": "A", "predicate": "relates_to",
	}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (нет targetName)", w.Code)
	}
}

// ─────────────────── постановка задач ───────────────────

func TestStartRunRequiresPipeline(t *testing.T) {
	router, _, _ := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/runs/start", map[string]any{}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestStartRunUsesInvokeWhenInputsGiven(t *testing.T) {
	router, _, fake := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/runs/start", map[string]any{
		"pipeline_id": "p1",
		"inputs":      map[string]any{"text": "привет"},
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	// runs.start не принимает inputs — данные передаются только через invoke.
	if len(fake.callsTo("runs.invoke")) != 1 {
		t.Fatalf("ожидался вызов runs.invoke, вызовы: %+v", fake.calls)
	}
	if len(fake.callsTo("runs.start")) != 0 {
		t.Fatalf("runs.start не должен вызываться при наличии inputs")
	}
}

func TestStartRunWithoutInputsUsesStart(t *testing.T) {
	router, _, fake := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/runs/start", map[string]any{
		"pipeline_id": "p1",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	if len(fake.callsTo("runs.start")) != 1 {
		t.Fatalf("ожидался runs.start, вызовы: %+v", fake.calls)
	}
}

func TestStartRunStampsRunIDOnTopic(t *testing.T) {
	router, s, fake := newMASysWriteRouter(t)
	fake.mu.Lock()
	fake.reply = `{"runId":"run-42","status":"started"}`
	fake.mu.Unlock()

	wb := model.NewWorkbook("Карта")
	sheet := model.NewSheet("Корень")
	child := model.NewTopic("Задача")
	sheet.RootTopic.Children = []*model.Topic{child}
	wb.AddSheet(sheet)
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/runs/start", map[string]any{
		"pipeline_id": "p1",
		"workbook_id": wb.ID,
		"topic_id":    child.ID,
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	// Карта должна помнить, где была поставлена работа.
	saved, err := s.GetWorkbook(wb.ID)
	if err != nil {
		t.Fatal(err)
	}
	got := saved.Sheets[0].RootTopic.Children[0].MasysRunID
	if got != "run-42" {
		t.Fatalf("masys_run_id = %q, want run-42", got)
	}
}

// ─────────────────── push узлов в граф ───────────────────

func TestPushSendsTypedNodesOnly(t *testing.T) {
	router, s, fake := newMASysWriteRouter(t)

	wb := model.NewWorkbook("Лаборатория")
	sheet := model.NewSheet("Корень")
	sheet.RootTopic.MemoryKind = "semantic"
	typed := model.NewTopic("Понятие")
	typed.MemoryKind = "concept"
	typed.Body = "описание понятия"
	plain := model.NewTopic("Обычный узел") // без memory_kind — в граф не идёт
	sheet.RootTopic.Children = []*model.Topic{typed, plain}
	wb.AddSheet(sheet)
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/push", map[string]any{
		"workbook_id": wb.ID,
		"namespace":   "lab",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	var resp PushResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	// Корень + типизированный ребёнок = 2; нетипизированный пропущен.
	if resp.EntitiesPushed != 2 || resp.Skipped != 1 {
		t.Fatalf("resp = %+v, want 2 сущности и 1 пропуск", resp)
	}
	for _, c := range fake.callsTo("memory.entity.upsert") {
		if c.Input["name"] == "Обычный узел" {
			t.Fatalf("нетипизированный узел ушёл в граф")
		}
		if c.Input["namespace"] != "lab" {
			t.Fatalf("namespace = %v", c.Input["namespace"])
		}
	}
}

func TestPushStampsRefsForIdempotency(t *testing.T) {
	router, s, fake := newMASysWriteRouter(t)

	wb := model.NewWorkbook("Лаборатория")
	sheet := model.NewSheet("Корень")
	sheet.RootTopic.MemoryKind = "semantic"
	wb.AddSheet(sheet)
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	push := func() {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/push", map[string]any{
			"workbook_id": wb.ID, "namespace": "lab",
		}))
		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
		}
	}
	push()

	saved, _ := s.GetWorkbook(wb.ID)
	ref := saved.Sheets[0].RootTopic.MasysRef
	if ref == nil || ref.Key != "Корень" || ref.Namespace != "lab" {
		t.Fatalf("ref = %+v — узел должен получить привязку", ref)
	}

	// Переименование в Gmind не должно создать в MASys дубль: ключ берётся из ref.
	saved.Sheets[0].RootTopic.Title = "Корень переименован"
	if err := s.UpdateWorkbook(saved); err != nil {
		t.Fatal(err)
	}
	push()

	for _, c := range fake.callsTo("memory.entity.upsert") {
		if c.Input["name"] == "Корень переименован" {
			t.Fatalf("после переименования ушло новое имя — появился бы дубль")
		}
	}
}

func TestPushSendsRelationsBetweenPushedNodes(t *testing.T) {
	router, s, fake := newMASysWriteRouter(t)

	wb := model.NewWorkbook("Лаборатория")
	sheet := model.NewSheet("Корень")
	sheet.RootTopic.MemoryKind = "semantic"
	a := model.NewTopic("A")
	a.MemoryKind = "concept"
	b := model.NewTopic("B")
	b.MemoryKind = "concept"
	sheet.RootTopic.Children = []*model.Topic{a, b}
	wb.AddSheet(sheet)
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	rels := store.NewRelationshipStore(s.DB())
	if err := rels.Insert(&store.RelationshipRecord{
		WorkbookID: wb.ID, FromTopicID: a.ID, ToTopicID: b.ID,
		Type: "depends_on", Title: "зависит от",
	}); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/push", map[string]any{
		"workbook_id": wb.ID, "namespace": "lab",
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	calls := fake.callsTo("memory.kg.addRelation")
	if len(calls) != 1 {
		t.Fatalf("связей отправлено %d, want 1", len(calls))
	}
	if calls[0].Input["sourceName"] != "A" || calls[0].Input["targetName"] != "B" {
		t.Fatalf("input = %+v", calls[0].Input)
	}
	// Предикат — заголовок связи, если он задан.
	if calls[0].Input["predicate"] != "зависит от" {
		t.Fatalf("predicate = %v", calls[0].Input["predicate"])
	}
}

func TestPushOnlySelectedTopics(t *testing.T) {
	router, s, _ := newMASysWriteRouter(t)

	wb := model.NewWorkbook("Лаборатория")
	sheet := model.NewSheet("Корень")
	sheet.RootTopic.MemoryKind = "semantic"
	a := model.NewTopic("A")
	a.MemoryKind = "concept"
	b := model.NewTopic("B")
	b.MemoryKind = "concept"
	sheet.RootTopic.Children = []*model.Topic{a, b}
	wb.AddSheet(sheet)
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/push", map[string]any{
		"workbook_id": wb.ID,
		"topic_ids":   []string{a.ID},
	}))
	var resp PushResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.EntitiesPushed != 1 {
		t.Fatalf("отправлено %d, want 1 (только выделенный узел)", resp.EntitiesPushed)
	}
}

func TestPushReportsErrorsWithoutFailingWholeRequest(t *testing.T) {
	router, s, fake := newMASysWriteRouter(t)
	fake.mu.Lock()
	fake.failMethod = "memory.entity.upsert"
	fake.mu.Unlock()

	wb := model.NewWorkbook("Лаборатория")
	sheet := model.NewSheet("Корень")
	sheet.RootTopic.MemoryKind = "semantic"
	wb.AddSheet(sheet)
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/push", map[string]any{"workbook_id": wb.ID}))
	// Частичная неудача не должна ронять всю отправку — отчёт важнее.
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 с отчётом", w.Code)
	}
	var resp PushResponse
	_ = json.Unmarshal(w.Body.Bytes(), &resp)
	if resp.EntitiesPushed != 0 || len(resp.Errors) == 0 {
		t.Fatalf("resp = %+v — ожидались нули и текст ошибки", resp)
	}
}

func TestPushRequiresWorkbook(t *testing.T) {
	router, _, _ := newMASysWriteRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/masys/push", map[string]any{}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}
