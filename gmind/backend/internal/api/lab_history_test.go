package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func historyHandler(t *testing.T) (*Handler, string) {
	t.Helper()
	base := t.TempDir()
	h := labHandler(t)
	h.labHistoryPath = base
	return h, base
}

// writeReport кладёт в проект отчёт с заданным временем начала.
func writeReport(t *testing.T, dir, lab, startedAt string, rows int) {
	t.Helper()
	out := filepath.Join(dir, "lab-out", lab)
	if err := os.MkdirAll(out, 0o755); err != nil {
		t.Fatal(err)
	}
	rowsJSON := "["
	for i := 0; i < rows; i++ {
		if i > 0 {
			rowsJSON += ","
		}
		rowsJSON += `{"caseId":"c","variantId":"v","ok":true}`
	}
	rowsJSON += "]"
	body := `{"lab":"` + lab + `","startedAt":"` + startedAt + `","gate":true,"gateFailed":false,` +
		`"summaries":[{"variantId":"v","total":1,"ok":1}],"rows":` + rowsJSON + `}`
	if err := os.WriteFile(filepath.Join(out, "report.json"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestArchiveKeepsOneCopyPerRun(t *testing.T) {
	h, base := historyHandler(t)
	dir := makeLabProject(t, "GM", "gmind", false)
	writeReport(t, dir, "demo", "2026-09-01T10:00:00.000Z", 2)

	first, err := archiveLabReport(base, dir, "demo")
	if err != nil {
		t.Fatal(err)
	}
	// Повторный вызов на том же отчёте не заводит второй файл: версия — это
	// время НАЧАЛА прогона, а не время копирования.
	second, err := archiveLabReport(base, dir, "demo")
	if err != nil {
		t.Fatal(err)
	}
	if first != second {
		t.Errorf("тот же прогон записан дважды: %s и %s", first, second)
	}
	if got := len(listLabHistory(base, dir, "demo")); got != 1 {
		t.Fatalf("в архиве %d записей, ожидалась одна", got)
	}

	// Новый прогон — новая версия рядом со старой.
	writeReport(t, dir, "demo", "2026-09-02T10:00:00.000Z", 3)
	if _, err := archiveLabReport(base, dir, "demo"); err != nil {
		t.Fatal(err)
	}
	entries := listLabHistory(base, dir, "demo")
	if len(entries) != 2 {
		t.Fatalf("в архиве %d записей, ожидалось две", len(entries))
	}
	// Свежие сверху.
	if entries[0].StartedAt != "2026-09-02T10:00:00.000Z" {
		t.Errorf("порядок не от свежего: %s", entries[0].StartedAt)
	}
	if entries[0].Rows != 3 || entries[1].Rows != 2 {
		t.Errorf("строки прочитаны неверно: %d и %d", entries[0].Rows, entries[1].Rows)
	}
	_ = h
}

// Архив Gmind не пишет в каталог чужого проекта.
func TestArchiveDoesNotTouchProjectDir(t *testing.T) {
	_, base := historyHandler(t)
	dir := makeLabProject(t, "GM", "gmind", false)
	writeReport(t, dir, "demo", "2026-09-01T10:00:00.000Z", 1)

	before := listTree(t, dir)
	if _, err := archiveLabReport(base, dir, "demo"); err != nil {
		t.Fatal(err)
	}
	after := listTree(t, dir)
	if len(before) != len(after) {
		t.Errorf("в каталоге проекта появились файлы: было %d, стало %d", len(before), len(after))
	}
}

func listTree(t *testing.T, root string) []string {
	t.Helper()
	var out []string
	if err := filepath.Walk(root, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		out = append(out, p)
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	return out
}

// Отчёт без времени начала архивируется единственной версией, а не под меткой
// времени копирования — та говорила бы, когда Gmind увидел файл.
func TestArchiveReportWithoutTimestamp(t *testing.T) {
	_, base := historyHandler(t)
	dir := makeLabProject(t, "GM", "gmind", false)
	out := filepath.Join(dir, "lab-out", "demo")
	if err := os.MkdirAll(out, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(out, "report.json"), []byte(`{"lab":"demo"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if _, err := archiveLabReport(base, dir, "demo"); err != nil {
			t.Fatal(err)
		}
	}
	entries := listLabHistory(base, dir, "demo")
	if len(entries) != 1 || entries[0].At != "unknown" {
		t.Fatalf("ожидалась одна запись «unknown», получено %+v", entries)
	}
}

func TestLabHistoryEndpointArchivesCurrentReport(t *testing.T) {
	h, _ := historyHandler(t)
	dir := makeLabProject(t, "GM", "gmind", false)
	writeReport(t, dir, "demo", "2026-09-01T10:00:00.000Z", 2)
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	url := "/api/v1/lab/history?path=" + dir + "&lab=demo"
	h.ListLabHistory(rec, httptest.NewRequest(http.MethodGet, url, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
	}
	var resp struct{ History []labHistoryEntry }
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	// Прогон, сделанный в терминале, попадает в историю при первом же взгляде.
	if len(resp.History) != 1 {
		t.Fatalf("история пуста: %+v", resp)
	}

	rec = httptest.NewRecorder()
	url = "/api/v1/lab/history/report?path=" + dir + "&lab=demo&at=" + resp.History[0].At
	h.GetLabHistoryReport(rec, httptest.NewRequest(http.MethodGet, url, nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("отчёт из архива: статус %d", rec.Code)
	}
	var report map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &report); err != nil {
		t.Fatal(err)
	}
	if _, ok := report["rows"]; !ok {
		t.Error("в архивном отчёте нет строк")
	}
}

func TestLabHistoryRejectsTraversal(t *testing.T) {
	h, _ := historyHandler(t)
	dir := makeLabProject(t, "GM", "gmind", false)
	writeReport(t, dir, "demo", "2026-09-01T10:00:00.000Z", 1)
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}
	for _, at := range []string{"", "../secret", `..\secret`, "sub/x"} {
		rec := httptest.NewRecorder()
		url := "/api/v1/lab/history/report?path=" + dir + "&lab=demo&at=" + at
		h.GetLabHistoryReport(rec, httptest.NewRequest(http.MethodGet, url, nil))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("at=%q: статус %d, ожидался 400", at, rec.Code)
		}
	}
}

// Слаг разводит проекты между собой: две разные машины-пути не должны слиться
// в один каталог архива.
func TestProjectSlugSeparatesProjects(t *testing.T) {
	a := labProjectSlug(`D:\Gmind`)
	b := labProjectSlug(`E:\MASys`)
	if a == b || a == "" || b == "" {
		t.Fatalf("слаги совпали или пусты: %q и %q", a, b)
	}
	if labProjectSlug(`D:\Gmind`) != labProjectSlug(`d:/gmind`) {
		t.Error("одинаковый каталог в разном написании дал разные слаги")
	}
}
