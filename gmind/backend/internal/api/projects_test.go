package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/xmind"
)

func writeProjectTree(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for path, content := range files {
		full := filepath.Join(root, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

type scanResponse struct {
	Path  string       `json:"path"`
	Title string       `json:"title"`
	Root  *model.Topic `json:"root"`
	Stats struct {
		Dirs      int  `json:"dirs"`
		Files     int  `json:"files"`
		Markdown  int  `json:"markdown"`
		XMind     int  `json:"xmind"`
		Truncated bool `json:"truncated"`
	} `json:"stats"`
}

func TestScanProjectReturnsTreeWithoutSaving(t *testing.T) {
	router, s, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{
		"README.md":      "# проект",
		"docs/plan.md":   "# план",
		"docs/map.xmind": "zip",
		"src/main.go":    "package main",
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/scan", map[string]any{"path": dir}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	var resp scanResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v (%s)", err, w.Body.String())
	}
	if resp.Stats.Markdown != 2 || resp.Stats.XMind != 1 {
		t.Errorf("stats = %+v, want md=2 xmind=1", resp.Stats)
	}
	if resp.Root == nil || len(resp.Root.Children) == 0 {
		t.Fatal("схема должна прийти вместе со сводкой")
	}

	// Предпросмотр ничего не сохраняет.
	books, err := s.ListWorkbooks()
	if err != nil {
		t.Fatal(err)
	}
	for _, wb := range books {
		if wb.SourcePath == dir {
			t.Fatalf("scan сохранил книгу %q, а должен только показать", wb.Title)
		}
	}
}

func TestScanProjectAcceptsQueryOptions(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{
		"docs/plan.md": "# план",
		"src/main.go":  "package main",
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/api/v1/projects/scan?docs_only=1&path="+dir, nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var resp scanResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if resp.Stats.Files != 1 || resp.Stats.Markdown != 1 {
		t.Errorf("docs_only: stats = %+v, want единственный .md", resp.Stats)
	}
}

func TestImportProjectCreatesOpenableWorkbook(t *testing.T) {
	router, s, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{
		"docs/plan.md":   "# план",
		"docs/map.xmind": "zip",
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/import", map[string]any{
		"path":  dir,
		"title": "Схема проекта",
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}

	var resp struct {
		Workbook *model.Workbook `json:"workbook"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v (%s)", err, w.Body.String())
	}
	if resp.Workbook == nil || len(resp.Workbook.Sheets) != 1 {
		t.Fatalf("книга = %+v", resp.Workbook)
	}
	if resp.Workbook.Title != "Схема проекта" {
		t.Errorf("title = %q", resp.Workbook.Title)
	}
	// Книга помнит каталог-источник — по нему карту можно пересобрать.
	if resp.Workbook.SourcePath != dir {
		t.Errorf("source_path = %q, want %q", resp.Workbook.SourcePath, dir)
	}

	stored, err := s.GetWorkbook(resp.Workbook.ID)
	if err != nil {
		t.Fatalf("книга должна сохраниться: %v", err)
	}
	if stored.Sheets[0].RootTopic == nil || len(stored.Sheets[0].RootTopic.Children) == 0 {
		t.Fatal("в сохранённой книге должна быть схема каталога")
	}
}

func TestProjectEndpointsRejectBadPath(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)
	missing := filepath.Join(t.TempDir(), "нет-такого")

	for _, path := range []string{"/api/v1/projects/scan", "/api/v1/projects/import"} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, requestJSON(t, "POST", path, map[string]any{"path": missing}))
		if w.Code != http.StatusBadRequest {
			t.Errorf("%s: status = %d, want 400 (body %s)", path, w.Code, w.Body.String())
		}
	}
}

func TestBrowseProjectDirsListsSubfolders(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{
		"alpha/file.txt":  "x",
		"beta/file.txt":   "x",
		".hidden/file.md": "x",
		"top.md":          "x",
	})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/projects/dirs?path="+dir, nil))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	var resp struct {
		Path   string `json:"path"`
		Parent string `json:"parent"`
		Dirs   []struct {
			Name string `json:"name"`
			Path string `json:"path"`
		} `json:"dirs"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Dirs) != 2 || resp.Dirs[0].Name != "alpha" || resp.Dirs[1].Name != "beta" {
		t.Errorf("dirs = %+v, want alpha и beta по алфавиту", resp.Dirs)
	}
	if resp.Parent == "" {
		t.Error("родительский каталог нужен для навигации вверх")
	}
}

func TestOpenProjectDocOpensMarkdown(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{"docs/plan.md": "# План\n\nтело\n\n## Раздел\n"})
	path := filepath.Join(dir, "docs", "plan.md")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/open-doc", map[string]any{"path": path}))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	wb := decodeWorkbook(t, w.Body.Bytes())
	if wb.Sheets[0].RootTopic.Title != "План" {
		t.Errorf("корень = %+v", wb.Sheets[0].RootTopic)
	}
	if wb.SourcePath != path {
		t.Errorf("source_path = %q, want %q", wb.SourcePath, path)
	}
}

func TestOpenProjectDocOpensXMind(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)
	source := model.NewWorkbook("Карта")
	sheet := model.NewSheet("Лист")
	sheet.RootTopic = &model.Topic{
		ID: "r", Title: "Корень", Body: "тело узла",
		Children: []*model.Topic{{ID: "c", Title: "Дитя"}},
	}
	source.AddSheet(sheet)
	data, err := xmind.Export(source)
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "карта.xmind")
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/open-doc", map[string]any{"path": path}))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	wb := decodeWorkbook(t, w.Body.Bytes())
	root := wb.Sheets[0].RootTopic
	if root.Title != "Корень" || len(root.Children) != 1 {
		t.Fatalf("корень = %+v", root)
	}
	// .xmind открывается без потерь — тело узла на месте.
	if root.Body != "тело узла" {
		t.Errorf("тело узла = %q", root.Body)
	}
	if wb.SourcePath != path {
		t.Errorf("source_path = %q", wb.SourcePath)
	}
}

func TestOpenProjectDocRejectsOtherFormats(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{"src/main.go": "package main"})

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/open-doc", map[string]any{
		"path": filepath.Join(dir, "src", "main.go"),
	}))
	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400 (body %s)", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/open-doc", map[string]any{
		"path": filepath.Join(dir, "нет.md"),
	}))
	if w.Code != http.StatusNotFound {
		t.Errorf("отсутствующий файл: status = %d, want 404", w.Code)
	}
}

func TestOpenProjectDocReusesMapOfTheSameFile(t *testing.T) {
	router, s, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{"plan.md": "# План\n"})
	path := filepath.Join(dir, "plan.md")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/open-doc", map[string]any{"path": path}))
	first := decodeWorkbook(t, w.Body.Bytes())

	w = httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/open-doc", map[string]any{
		"path": path, "reuse": true,
	}))
	second := decodeWorkbook(t, w.Body.Bytes())

	if first.ID != second.ID {
		t.Errorf("повторное открытие завело вторую книгу: %s vs %s", first.ID, second.ID)
	}
	books, err := s.ListWorkbooks()
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, wb := range books {
		if wb.SourcePath == path {
			count++
		}
	}
	if count != 1 {
		t.Errorf("книг для одного файла: %d", count)
	}
}

func TestCreateProjectFileCreatesMarkdownAndRefreshesWorkbook(t *testing.T) {
	router, s, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{"docs/existing.md": "# Existing\n"})

	importRecorder := httptest.NewRecorder()
	router.ServeHTTP(importRecorder, requestJSON(t, "POST", "/api/v1/projects/import", map[string]any{
		"path": dir,
	}))
	if importRecorder.Code != http.StatusCreated {
		t.Fatalf("import status = %d, body = %s", importRecorder.Code, importRecorder.Body.String())
	}
	var imported struct {
		Workbook *model.Workbook `json:"workbook"`
	}
	if err := json.Unmarshal(importRecorder.Body.Bytes(), &imported); err != nil {
		t.Fatal(err)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/projects/files", map[string]any{
		"root":        dir,
		"workbook_id": imported.Workbook.ID,
		"directory":   filepath.Join(dir, "docs"),
		"name":        "Новая заметка",
	}))
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	createdPath := filepath.Join(dir, "docs", "Новая заметка.md")
	data, err := os.ReadFile(createdPath)
	if err != nil {
		t.Fatalf("created file: %v", err)
	}
	if string(data) != "# Новая заметка\n" {
		t.Errorf("content = %q", string(data))
	}

	stored, err := s.GetWorkbook(imported.Workbook.ID)
	if err != nil || stored == nil {
		t.Fatalf("stored workbook: %v", err)
	}
	if !projectTreeHasTitle(stored.Sheets[0].RootTopic, "Новая заметка.md") {
		t.Fatal("пересобранная карта не содержит новый файл")
	}

	duplicate := httptest.NewRecorder()
	router.ServeHTTP(duplicate, requestJSON(t, "POST", "/api/v1/projects/files", map[string]any{
		"root":        dir,
		"workbook_id": imported.Workbook.ID,
		"directory":   filepath.Join(dir, "docs"),
		"name":        "Новая заметка.md",
	}))
	if duplicate.Code != http.StatusConflict {
		t.Errorf("duplicate status = %d, want 409", duplicate.Code)
	}
}

func TestProjectFileMutationRejectsPathOutsideRoot(t *testing.T) {
	router, _, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{"inside.md": "# Inside\n"})
	outside := writeProjectTree(t, map[string]string{"outside.md": "# Outside\n"})

	importRecorder := httptest.NewRecorder()
	router.ServeHTTP(importRecorder, requestJSON(t, "POST", "/api/v1/projects/import", map[string]any{"path": dir}))
	var imported struct {
		Workbook *model.Workbook `json:"workbook"`
	}
	if err := json.Unmarshal(importRecorder.Body.Bytes(), &imported); err != nil {
		t.Fatal(err)
	}

	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, requestJSON(t, "POST", "/api/v1/projects/files", map[string]any{
		"root": dir, "workbook_id": imported.Workbook.ID, "directory": outside, "name": "escape.md",
	}))
	if createRecorder.Code != http.StatusBadRequest {
		t.Errorf("create outside status = %d, want 400", createRecorder.Code)
	}

	deleteRecorder := httptest.NewRecorder()
	router.ServeHTTP(deleteRecorder, requestJSON(t, "DELETE", "/api/v1/projects/files", map[string]any{
		"root": dir, "workbook_id": imported.Workbook.ID, "path": filepath.Join(outside, "outside.md"),
	}))
	if deleteRecorder.Code != http.StatusBadRequest {
		t.Errorf("delete outside status = %d, want 400", deleteRecorder.Code)
	}
	if _, err := os.Stat(filepath.Join(outside, "outside.md")); err != nil {
		t.Fatalf("outside file was changed: %v", err)
	}
}

func TestDeleteProjectFileRefreshesRootAndRemovesLinkedWorkbook(t *testing.T) {
	router, s, _ := newMarkdownRouter(t)
	dir := writeProjectTree(t, map[string]string{"docs/plan.md": "# План\n"})
	path := filepath.Join(dir, "docs", "plan.md")

	importRecorder := httptest.NewRecorder()
	router.ServeHTTP(importRecorder, requestJSON(t, "POST", "/api/v1/projects/import", map[string]any{"path": dir}))
	var imported struct {
		Workbook *model.Workbook `json:"workbook"`
	}
	if err := json.Unmarshal(importRecorder.Body.Bytes(), &imported); err != nil {
		t.Fatal(err)
	}

	openRecorder := httptest.NewRecorder()
	router.ServeHTTP(openRecorder, requestJSON(t, "POST", "/api/v1/projects/open-doc", map[string]any{"path": path}))
	linked := decodeWorkbook(t, openRecorder.Body.Bytes())

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "DELETE", "/api/v1/projects/files", map[string]any{
		"root": dir, "workbook_id": imported.Workbook.ID, "path": path,
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", w.Code, w.Body.String())
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("file still exists: %v", err)
	}
	if deleted, err := s.GetWorkbook(linked.ID); err != nil || deleted != nil {
		t.Fatalf("linked workbook still exists: wb=%+v err=%v", deleted, err)
	}
	stored, err := s.GetWorkbook(imported.Workbook.ID)
	if err != nil || stored == nil {
		t.Fatalf("root workbook: %v", err)
	}
	if projectTreeHasTitle(stored.Sheets[0].RootTopic, "plan.md") {
		t.Fatal("пересобранная карта всё ещё содержит удалённый файл")
	}
}

func projectTreeHasTitle(topic *model.Topic, title string) bool {
	if topic == nil {
		return false
	}
	if topic.Title == title {
		return true
	}
	for _, child := range topic.Children {
		if projectTreeHasTitle(child, title) {
			return true
		}
	}
	return false
}
