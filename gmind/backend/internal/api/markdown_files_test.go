package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
)

// newMarkdownRouter поднимает роутер с Markdown-хранилищем во временном каталоге.
func newMarkdownRouter(t *testing.T) (http.Handler, *store.Store, string) {
	t.Helper()
	s, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })

	vault := t.TempDir()
	h := New(s, nil, "", nil, nil)
	cfg := &config.Config{AllowedOrigins: []string{"*"}, MarkdownPath: vault}
	return h.Router(cfg), s, vault
}

func decodeWorkbook(t *testing.T, body []byte) *model.Workbook {
	t.Helper()
	var wb model.Workbook
	if err := json.Unmarshal(body, &wb); err != nil {
		t.Fatalf("decode workbook: %v (%s)", err, string(body))
	}
	return &wb
}

func TestImportMarkdownCreatesTree(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/import/markdown", map[string]string{
		"content": "# Корень\n\nтело\n\n## Раздел\n\n- пункт\n",
		"title":   "Файл",
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	wb := decodeWorkbook(t, w.Body.Bytes())
	root := wb.Sheets[0].RootTopic
	if root.Title != "Корень" || root.Body != "тело" {
		t.Fatalf("root = %+v", root)
	}
	if len(root.Children) != 1 || root.Children[0].Title != "Раздел" {
		t.Fatalf("children = %+v", root.Children)
	}
	if len(root.Children[0].Children) != 1 || root.Children[0].Children[0].Title != "пункт" {
		t.Fatalf("list item lost: %+v", root.Children[0].Children)
	}
}

func TestOpenAndSaveMarkdownFile(t *testing.T) {
	router, _, vault := newMarkdownRouter(t)

	path := filepath.Join(vault, "notes.md")
	if err := os.WriteFile(path, []byte("# Заметки\n\n## Первая\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	// Открыть файл как карту.
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/md/open", map[string]any{"path": path}))
	if w.Code != http.StatusCreated {
		t.Fatalf("open status = %d, body = %s", w.Code, w.Body.String())
	}
	wb := decodeWorkbook(t, w.Body.Bytes())
	if wb.SourcePath != filepath.Clean(path) {
		t.Fatalf("source_path = %q, want %q", wb.SourcePath, path)
	}
	if wb.Sheets[0].RootTopic.Title != "Заметки" {
		t.Fatalf("root title = %q", wb.Sheets[0].RootTopic.Title)
	}

	// Дописать узел и сохранить обратно в тот же файл.
	w = httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wb.ID+"/topics", map[string]any{
		"parent_id": wb.Sheets[0].RootTopic.ID,
		"title":     "Вторая",
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("create topic status = %d, body = %s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wb.ID+"/md/save", map[string]any{}))
	if w.Code != http.StatusOK {
		t.Fatalf("save status = %d, body = %s", w.Code, w.Body.String())
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "## Вторая") {
		t.Fatalf("file not updated:\n%s", string(data))
	}
}

func TestSaveMarkdownWithoutLinkGoesToVault(t *testing.T) {
	router, _, vault := newMarkdownRouter(t)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Моя карта"}))
	wb := decodeWorkbook(t, w.Body.Bytes())

	w = httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wb.ID+"/md/save", map[string]any{}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	want := filepath.Join(vault, "Моя карта.md")
	if _, err := os.Stat(want); err != nil {
		t.Fatalf("file not created at %s: %v", want, err)
	}
}

func TestReloadMarkdownPicksUpExternalEdit(t *testing.T) {
	router, _, vault := newMarkdownRouter(t)

	path := filepath.Join(vault, "sync.md")
	os.WriteFile(path, []byte("# A\n"), 0o644)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/md/open", map[string]any{"path": path}))
	wb := decodeWorkbook(t, w.Body.Bytes())

	// Файл поменяли снаружи (другой редактор).
	os.WriteFile(path, []byte("# A\n\n## Новое\n"), 0o644)

	w = httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wb.ID+"/md/reload", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("reload status = %d, body = %s", w.Code, w.Body.String())
	}
	reloaded := decodeWorkbook(t, w.Body.Bytes())
	if len(reloaded.Sheets[0].RootTopic.Children) != 1 {
		t.Fatalf("external edit not picked up: %+v", reloaded.Sheets[0].RootTopic)
	}
}

func TestListMarkdownFiles(t *testing.T) {
	router, _, vault := newMarkdownRouter(t)
	os.WriteFile(filepath.Join(vault, "a.md"), []byte("# A"), 0o644)
	os.WriteFile(filepath.Join(vault, "b.txt"), []byte("nope"), 0o644)
	os.Mkdir(filepath.Join(vault, "sub"), 0o755)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/md/files", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var resp struct {
		Dir   string             `json:"dir"`
		Files []MarkdownFileInfo `json:"files"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Files) != 2 {
		t.Fatalf("files = %+v, want sub/ and a.md", resp.Files)
	}
	if !resp.Files[0].Dir || resp.Files[0].Name != "sub" {
		t.Fatalf("directories should come first: %+v", resp.Files)
	}
	if resp.Files[1].Name != "a.md" {
		t.Fatalf(".txt should be filtered out: %+v", resp.Files)
	}
}

func TestOpenRejectsNonMarkdown(t *testing.T) {
	router, _, vault := newMarkdownRouter(t)
	path := filepath.Join(vault, "x.txt")
	os.WriteFile(path, []byte("hi"), 0o644)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/md/open", map[string]any{"path": path}))
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
}

func TestExportMarkdownIncludesBody(t *testing.T) {
	router, s, _ := newMarkdownRouter(t)

	wb := model.NewWorkbook("Экспорт")
	sheet := model.NewSheet("Корень")
	sheet.RootTopic.Body = "тело корня"
	sheet.RootTopic.Children = []*model.Topic{{ID: "c1", Title: "Дочерний", Notes: "заметка"}}
	wb.AddSheet(sheet)
	if err := s.CreateWorkbook(wb); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/workbooks/"+wb.ID+"/export/markdown", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d", w.Code)
	}
	out := w.Body.String()
	if !strings.Contains(out, "тело корня") || !strings.Contains(out, "> заметка") {
		t.Fatalf("export lost body/notes:\n%s", out)
	}
}
