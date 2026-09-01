package project

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gmind/backend/internal/model"
)

// makeTree раскладывает описанный набор путей во временном каталоге.
// Путь, оканчивающийся на "/", создаётся как пустой каталог.
func makeTree(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for path, content := range files {
		full := filepath.Join(root, filepath.FromSlash(path))
		if strings.HasSuffix(path, "/") {
			if err := os.MkdirAll(full, 0o755); err != nil {
				t.Fatalf("mkdir %s: %v", path, err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatalf("mkdir for %s: %v", path, err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}
	return root
}

func titles(topics []*model.Topic) []string {
	out := make([]string, 0, len(topics))
	for _, t := range topics {
		out = append(out, t.Title)
	}
	return out
}

func findTopic(root *model.Topic, title string) *model.Topic {
	if root == nil {
		return nil
	}
	if root.Title == title {
		return root
	}
	for _, child := range root.Children {
		if found := findTopic(child, title); found != nil {
			return found
		}
	}
	return nil
}

func countTopics(root *model.Topic) int {
	if root == nil {
		return 0
	}
	n := 1
	for _, child := range root.Children {
		n += countTopics(child)
	}
	return n
}

func TestScanBuildsFolderTree(t *testing.T) {
	root := makeTree(t, map[string]string{
		"README.md":        "# проект",
		"docs/plan.md":     "# план",
		"docs/idea.xmind":  "zip",
		"src/main.go":      "package main",
		"src/util/util.go": "package util",
		"empty/":           "",
	})

	topic, stats, err := Scan(root, Options{})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	if topic.Title != filepath.Base(root) {
		t.Errorf("root title = %q, want %q", topic.Title, filepath.Base(root))
	}
	// Каталоги идут раньше файлов, внутри группы — по алфавиту: схема должна
	// выглядеть одинаково при каждом обходе.
	want := []string{"docs", "empty", "src", "README.md"}
	if got := titles(topic.Children); !equal(got, want) {
		t.Errorf("children = %v, want %v", got, want)
	}
	if stats.Dirs != 4 || stats.Files != 5 {
		t.Errorf("stats = %+v, want 4 dirs / 5 files", stats)
	}
	if stats.Markdown != 2 || stats.XMind != 1 {
		t.Errorf("doc stats = %+v, want md=2 xmind=1", stats)
	}
	if stats.Truncated {
		t.Error("small tree must not be truncated")
	}
}

func TestScanLinksDocumentsToTheirFiles(t *testing.T) {
	root := makeTree(t, map[string]string{
		"docs/plan.md":    "# план",
		"docs/idea.xmind": "zip",
		"docs/notes.txt":  "текст",
	})

	topic, _, err := Scan(root, Options{})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}

	md := findTopic(topic, "plan.md")
	if md == nil || md.Hyperlink == "" {
		t.Fatalf("plan.md must carry a link to the file, got %+v", md)
	}
	if !strings.HasSuffix(md.Hyperlink, filepath.FromSlash("docs/plan.md")) {
		t.Errorf("plan.md link = %q", md.Hyperlink)
	}
	xm := findTopic(topic, "idea.xmind")
	if xm == nil || xm.Hyperlink == "" {
		t.Fatal("idea.xmind must carry a link to the file")
	}
	// Форматы различимы: по метке фронтенд знает, чем открывать узел.
	if len(md.Labels) == 0 || md.Labels[0] != "markdown" {
		t.Errorf("markdown label = %v", md.Labels)
	}
	if len(xm.Labels) == 0 || xm.Labels[0] != "xmind" {
		t.Errorf("xmind label = %v", xm.Labels)
	}
	txt := findTopic(topic, "notes.txt")
	if txt == nil {
		t.Fatal("notes.txt must be in the map")
	}
	if txt.Hyperlink != "" {
		t.Errorf("обычный файл не открывается как карта, ссылки быть не должно: %q", txt.Hyperlink)
	}
}

func TestScanSkipsNoiseDirectories(t *testing.T) {
	root := makeTree(t, map[string]string{
		"node_modules/lib/index.js": "x",
		"dist/bundle.js":            "x",
		".git/config":               "x",
		".env":                      "SECRET=1",
		"src/app.ts":                "x",
	})

	topic, stats, err := Scan(root, Options{})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	for _, noise := range []string{"node_modules", "dist", ".git", ".env"} {
		if findTopic(topic, noise) != nil {
			t.Errorf("%s must not appear in the project map", noise)
		}
	}
	if findTopic(topic, "app.ts") == nil {
		t.Error("src/app.ts must be in the map")
	}
	if stats.Dirs != 1 {
		t.Errorf("dirs = %d, want 1 (only src)", stats.Dirs)
	}
}

func TestScanIncludeHiddenAndCustomIgnore(t *testing.T) {
	root := makeTree(t, map[string]string{
		".github/workflows/ci.yml": "x",
		"docs/plan.md":             "# план",
	})

	topic, _, err := Scan(root, Options{IncludeHidden: true})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if findTopic(topic, ".github") == nil {
		t.Error("IncludeHidden must reveal .github")
	}

	topic, _, err = Scan(root, Options{IncludeHidden: true, Ignore: []string{"docs"}})
	if err != nil {
		t.Fatalf("scan with ignore: %v", err)
	}
	if findTopic(topic, "docs") != nil {
		t.Error("custom ignore must drop docs")
	}
}

func TestScanDocsOnlyPrunesBranchesWithoutDocuments(t *testing.T) {
	root := makeTree(t, map[string]string{
		"docs/plan.md":      "# план",
		"docs/deep/a.xmind": "zip",
		"src/main.go":       "package main",
		"src/util/u.go":     "package util",
	})

	topic, stats, err := Scan(root, Options{DocsOnly: true})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if findTopic(topic, "src") != nil {
		t.Error("ветка без документов должна отпасть в режиме DocsOnly")
	}
	if findTopic(topic, "main.go") != nil {
		t.Error("код не входит в схему документов")
	}
	if findTopic(topic, "plan.md") == nil || findTopic(topic, "a.xmind") == nil {
		t.Error("оба документа должны остаться")
	}
	if stats.Files != 2 || stats.Markdown != 1 || stats.XMind != 1 {
		t.Errorf("stats = %+v, want 2 files (1 md + 1 xmind)", stats)
	}
}

func TestScanRespectsMaxDepth(t *testing.T) {
	root := makeTree(t, map[string]string{
		"a/b/c/d/deep.md": "# глубоко",
		"a/b/near.md":     "# ближе",
	})

	// MaxDepth считает уровни записей: 3 = корень → a → b → near.md.
	topic, _, err := Scan(root, Options{MaxDepth: 3})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if findTopic(topic, "near.md") == nil {
		t.Error("near.md на втором уровне должен быть в карте")
	}
	if findTopic(topic, "deep.md") != nil {
		t.Error("deep.md глубже MaxDepth — в карте его быть не должно")
	}
}

func TestScanStopsAtMaxNodes(t *testing.T) {
	files := map[string]string{}
	for i := 0; i < 60; i++ {
		files[filepath.ToSlash(filepath.Join("many", "file"+string(rune('a'+i%26))+string(rune('a'+i/26))+".txt"))] = "x"
	}
	root := makeTree(t, files)

	topic, stats, err := Scan(root, Options{MaxNodes: 10})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if !stats.Truncated {
		t.Error("обход должен пометить карту усечённой")
	}
	if got := countTopics(topic); got > 12 {
		t.Errorf("узлов %d, потолок 10 (+служебные)", got)
	}
}

func TestScanRejectsBadPaths(t *testing.T) {
	if _, _, err := Scan("", Options{}); err == nil {
		t.Error("пустой путь должен быть ошибкой")
	}
	if _, _, err := Scan(filepath.Join(t.TempDir(), "нет-такого"), Options{}); err == nil {
		t.Error("несуществующий путь должен быть ошибкой")
	}
	file := filepath.Join(t.TempDir(), "file.md")
	if err := os.WriteFile(file, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, _, err := Scan(file, Options{}); err == nil {
		t.Error("файл вместо каталога должен быть ошибкой")
	}
}

func TestScanWorkbookProducesOpenableBook(t *testing.T) {
	root := makeTree(t, map[string]string{"docs/plan.md": "# план"})

	wb, stats, err := ScanWorkbook(root, "Мой проект", Options{})
	if err != nil {
		t.Fatalf("scan workbook: %v", err)
	}
	if wb.Title != "Мой проект" {
		t.Errorf("title = %q", wb.Title)
	}
	if len(wb.Sheets) != 1 || wb.Sheets[0].RootTopic == nil {
		t.Fatalf("книга должна содержать ровно один лист с корнем: %+v", wb.Sheets)
	}
	if wb.Sheets[0].RootTopic.Body == "" {
		t.Error("корень несёт сводку по проекту в теле узла")
	}
	if stats.Markdown != 1 {
		t.Errorf("stats.Markdown = %d, want 1", stats.Markdown)
	}
}

func TestScanIsDeterministic(t *testing.T) {
	root := makeTree(t, map[string]string{
		"b.md": "x", "a.md": "x", "z/one.md": "x", "y/two.md": "x",
	})
	first, _, err := Scan(root, Options{})
	if err != nil {
		t.Fatal(err)
	}
	second, _, err := Scan(root, Options{})
	if err != nil {
		t.Fatal(err)
	}
	if !equal(titles(first.Children), titles(second.Children)) {
		t.Errorf("порядок узлов должен совпадать: %v vs %v",
			titles(first.Children), titles(second.Children))
	}
}

func equal(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
