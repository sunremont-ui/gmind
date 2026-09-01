package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// makeLabProject собирает на диске каталог, похожий на проект с треком.
func makeLabProject(t *testing.T, track, namespace string, withReport bool) string {
	t.Helper()
	dir := t.TempDir()
	cfg := `{"version":1,"track":"` + track + `","namespace":"` + namespace + `",
	         "serverUrl":"http://localhost:5010",
	         "oracle":{"command":"node","args":["scripts/lab-oracle.mjs"]},
	         "exportPath":"wiki/lab-{track}.md"}`
	if err := os.WriteFile(filepath.Join(dir, "lab.config.json"), []byte(cfg), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "labs"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "labs", "demo.lab.mjs"), []byte("// замер"), 0o644); err != nil {
		t.Fatal(err)
	}
	if withReport {
		out := filepath.Join(dir, "lab-out", "demo")
		if err := os.MkdirAll(out, 0o755); err != nil {
			t.Fatal(err)
		}
		report := `{"lab":"demo","question":"вопрос замера","track":"` + track + `",
		            "startedAt":"2026-08-19T10:16:14.411Z","finishedAt":"2026-08-19T10:16:14.415Z",
		            "paid":false,"estimateRub":0,"gate":false,"gateFailed":false,
		            "summaries":[{"variantId":"один","total":2,"ok":2}],
		            "rows":[{"caseId":"a","variantId":"один","ok":true}]}`
		if err := os.WriteFile(filepath.Join(out, "report.json"), []byte(report), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return dir
}

func labHandler(t *testing.T) *Handler {
	t.Helper()
	return &Handler{labRegistry: newLabRegistry(filepath.Join(t.TempDir(), "lab-projects.json"))}
}

func TestAddLabProjectReadsConfigFromDisk(t *testing.T) {
	h := labHandler(t)
	dir := makeLabProject(t, "GM", "gmind", true)

	body := strings.NewReader(`{"path":` + jsonString(dir) + `}`)
	rec := httptest.NewRecorder()
	h.AddLabProject(rec, httptest.NewRequest(http.MethodPost, "/api/v1/lab/projects", body))
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
	}

	var resp struct{ Projects []labProject }
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Projects) != 1 {
		t.Fatalf("ожидался один проект, пришло %d", len(resp.Projects))
	}
	p := resp.Projects[0]
	// Трек и namespace НЕ передавались в запросе — они прочитаны из lab.config.json.
	if p.Track != "GM" || p.Namespace != "gmind" {
		t.Errorf("трек/namespace = %q/%q, ожидались GM/gmind", p.Track, p.Namespace)
	}
	if p.Oracle != "node scripts/lab-oracle.mjs" {
		t.Errorf("оракул = %q", p.Oracle)
	}
	if len(p.Labs) != 1 || p.Labs[0] != "demo" {
		t.Errorf("замеры = %v, ожидался [demo]", p.Labs)
	}
	if len(p.Reports) != 1 || p.Reports[0] != "demo" {
		t.Errorf("отчёты = %v, ожидался [demo]", p.Reports)
	}
}

func TestAddLabProjectRejectsDirWithoutConfig(t *testing.T) {
	h := labHandler(t)
	dir := t.TempDir() // каталога с lab.config.json нет

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"path":` + jsonString(dir) + `}`)
	h.AddLabProject(rec, httptest.NewRequest(http.MethodPost, "/api/v1/lab/projects", body))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("каталог без lab.config.json принят: статус %d", rec.Code)
	}
}

// Повторное добавление того же каталога — с другим написанием пути — обновляет
// строку, а не двоит её.
func TestAddLabProjectIsIdempotent(t *testing.T) {
	h := labHandler(t)
	dir := makeLabProject(t, "GM", "gmind", false)

	for _, variant := range []string{dir, filepath.ToSlash(dir) + "/"} {
		rec := httptest.NewRecorder()
		body := strings.NewReader(`{"path":` + jsonString(variant) + `,"label":"Gmind"}`)
		h.AddLabProject(rec, httptest.NewRequest(http.MethodPost, "/api/v1/lab/projects", body))
		if rec.Code != http.StatusOK {
			t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
		}
	}
	if got := len(h.labRegistry.load()); got != 1 {
		t.Fatalf("в реестре %d строк, ожидалась одна", got)
	}
}

func TestRemoveLabProject(t *testing.T) {
	h := labHandler(t)
	dir := makeLabProject(t, "GM", "gmind", false)
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodDelete, "/api/v1/lab/projects?path="+dir, nil)
	h.RemoveLabProject(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
	}
	if got := len(h.labRegistry.load()); got != 0 {
		t.Fatalf("в реестре осталось %d строк", got)
	}
}

// Пропавший каталог не роняет весь список: ошибка приходит полем строки.
func TestListLabProjectsReportsBrokenEntryInline(t *testing.T) {
	h := labHandler(t)
	good := makeLabProject(t, "GM", "gmind", false)
	gone := filepath.Join(t.TempDir(), "исчезнувший")
	if _, err := h.labRegistry.add(labRegistryEntry{Path: good}); err != nil {
		t.Fatal(err)
	}
	if _, err := h.labRegistry.add(labRegistryEntry{Path: gone}); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	h.ListLabProjects(rec, httptest.NewRequest(http.MethodGet, "/api/v1/lab/projects", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d", rec.Code)
	}
	var resp struct{ Projects []labProject }
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Projects) != 2 {
		t.Fatalf("проектов %d, ожидалось 2", len(resp.Projects))
	}
	if resp.Projects[0].Error != "" {
		t.Errorf("живой проект отмечен ошибкой: %s", resp.Projects[0].Error)
	}
	if resp.Projects[1].Error == "" {
		t.Error("пропавший каталог пришёл без ошибки")
	}
}

// Реестр работает allowlist'ом: незарегистрированный путь не читается.
func TestLabRunsRejectsUnregisteredDir(t *testing.T) {
	h := labHandler(t)
	dir := makeLabProject(t, "GM", "gmind", true)

	rec := httptest.NewRecorder()
	h.ListLabRuns(rec, httptest.NewRequest(http.MethodGet, "/api/v1/lab/runs?path="+dir, nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("статус %d, ожидался 403", rec.Code)
	}
}

func TestListLabRunsMergesScriptsAndReports(t *testing.T) {
	h := labHandler(t)
	dir := makeLabProject(t, "GM", "gmind", true)
	// Замер, у которого есть отчёт, но нет скрипта — прогон из прошлого дерева.
	out := filepath.Join(dir, "lab-out", "старый")
	if err := os.MkdirAll(out, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(out, "report.json"), []byte(`{"lab":"старый","gate":true}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	h.ListLabRuns(rec, httptest.NewRequest(http.MethodGet, "/api/v1/lab/runs?path="+dir, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct{ Runs []labRunSummary }
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Runs) != 2 {
		t.Fatalf("замеров %d, ожидалось 2", len(resp.Runs))
	}
	byName := map[string]labRunSummary{}
	for _, r := range resp.Runs {
		byName[r.Lab] = r
	}
	demo := byName["demo"]
	if !demo.HasScript || !demo.HasReport {
		t.Errorf("demo: скрипт=%v отчёт=%v, ожидалось оба", demo.HasScript, demo.HasReport)
	}
	if demo.Question != "вопрос замера" || len(demo.Summaries) != 1 {
		t.Errorf("шапка demo прочитана неверно: %+v", demo)
	}
	old := byName["старый"]
	if old.HasScript || !old.HasReport {
		t.Errorf("старый: скрипт=%v отчёт=%v, ожидались false/true", old.HasScript, old.HasReport)
	}
}

func TestGetLabRunRejectsPathTraversal(t *testing.T) {
	h := labHandler(t)
	dir := makeLabProject(t, "GM", "gmind", true)
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	for _, lab := range []string{"", "../secret", `..\secret`, "sub/demo"} {
		rec := httptest.NewRecorder()
		url := "/api/v1/lab/run?path=" + dir + "&lab=" + lab
		h.GetLabRun(rec, httptest.NewRequest(http.MethodGet, url, nil))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("lab=%q: статус %d, ожидался 400", lab, rec.Code)
		}
	}
}

func TestGetLabRunReturnsRows(t *testing.T) {
	h := labHandler(t)
	dir := makeLabProject(t, "GM", "gmind", true)
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	h.GetLabRun(rec, httptest.NewRequest(http.MethodGet, "/api/v1/lab/run?path="+dir+"&lab=demo", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
	}
	var report map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if _, ok := report["rows"]; !ok {
		t.Error("в ответе нет строк матрицы")
	}
}

func TestLabTrackStateRequiresTrack(t *testing.T) {
	h := labHandler(t)
	rec := httptest.NewRecorder()
	h.LabTrackState(rec, httptest.NewRequest(http.MethodGet, "/api/v1/lab/track", nil))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("статус %d, ожидался 400", rec.Code)
	}
}

// jsonString — путь Windows содержит обратные слэши; в литерал JSON он должен
// попадать экранированным, иначе тест сломается только на Windows.
func jsonString(s string) string {
	b, _ := json.Marshal(s)
	return string(b)
}

func TestCountTRPCListAcceptsBothShapes(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want int
		ok   bool
	}{
		{"массив", `[{"id":"a"},{"id":"b"}]`, 2, true},
		{"пустой массив", `[]`, 0, true},
		// Слой навыков отдаёт объект: {skills: [...], counts: {...}}.
		{"объект с массивом", `{"counts":{"total":13},"skills":[1,2,3]}`, 3, true},
		{"объект без массива", `{"counts":{"total":13}}`, 0, false},
		{"не список вовсе", `"строка"`, 0, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := countTRPCList(json.RawMessage(c.raw))
			if ok != c.ok || got != c.want {
				t.Errorf("countTRPCList(%s) = %d,%v; ожидалось %d,%v", c.raw, got, ok, c.want, c.ok)
			}
		})
	}
}

// Потолок выборки должен быть объявлен там же, где метод: иначе число, упершееся
// в предел, уедет на экран как точное.
func TestLabMemorySpecsDeclareCaps(t *testing.T) {
	byKey := map[string]labMemorySpec{}
	for _, s := range labMemorySpecs {
		if s.key == "" || s.method == "" || s.label == "" {
			t.Fatalf("неполный слой: %+v", s)
		}
		if _, dup := byKey[s.key]; dup {
			t.Fatalf("слой %q объявлен дважды", s.key)
		}
		byKey[s.key] = s
	}
	if byKey["episodes"].limit == 0 {
		t.Error("у эпизодов есть потолок выборки в MASys (200) — он должен быть объявлен")
	}
	if byKey["entities"].limit == 0 {
		t.Error("у сущностей есть потолок выборки в MASys (500) — он должен быть объявлен")
	}
	// У этих двух предел не только существует, но и применяется МОЛЧА, когда его
	// не попросили: 50 и 100 приходили как полный слой.
	if byKey["results"].limit == 0 {
		t.Error("result.list по умолчанию отдаёт 50 — предел должен быть запрошен явно")
	}
	if byKey["decisions"].limit == 0 {
		t.Error("controller.decisions по умолчанию отдаёт 100 — предел должен быть запрошен явно")
	}
}
