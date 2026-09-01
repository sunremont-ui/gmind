// Package project строит карту по каталогу проекта: папки становятся ветками,
// файлы — листьями. Это ответ на вопрос «покажи схему моего проекта»: путь к
// папке на входе, готовая карта на выходе, без ручного набора узлов.
//
// Форматы, ради которых всё затевалось, отмечаются отдельно: .md и .xmind
// получают Hyperlink на файл, поэтому такой узел можно открыть как карту.
package project

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/google/uuid"

	"github.com/gmind/backend/internal/model"
)

// DocExtensions — форматы, которые Gmind умеет открыть как карту.
var DocExtensions = map[string]string{
	".md":       "markdown",
	".markdown": "markdown",
	".xmind":    "xmind",
}

// DefaultIgnore — каталоги, которые в схеме проекта только мешают: они
// раздувают карту тысячами узлов и ничего не говорят о замысле проекта.
var DefaultIgnore = []string{
	".git", ".hg", ".svn", "node_modules", "vendor", "dist", "build", "out",
	"target", ".next", ".nuxt", ".cache", ".venv", "venv", "__pycache__",
	".pytest_cache", ".mypy_cache", "coverage", ".idea", ".vscode", ".gradle",
	".terraform", "bin", "obj", "tmp", ".turbo", ".parcel-cache",
}

const (
	// DefaultMaxDepth — глубина по умолчанию: дальше схема перестаёт читаться.
	DefaultMaxDepth = 6
	// DefaultMaxNodes — предохранитель: карта на десятки тысяч узлов бесполезна
	// и вешает отрисовку, поэтому обход останавливается и помечается усечённым.
	DefaultMaxNodes  = 4000
	maxChildrenShown = 200
)

type Options struct {
	// MaxDepth — сколько уровней каталогов разворачивать (0 → DefaultMaxDepth).
	MaxDepth int `json:"max_depth,omitempty"`
	// MaxNodes — потолок числа узлов (0 → DefaultMaxNodes).
	MaxNodes int `json:"max_nodes,omitempty"`
	// DocsOnly — оставить только .md/.xmind и папки, где они есть.
	DocsOnly bool `json:"docs_only,omitempty"`
	// Ignore — дополнительные имена каталогов к списку по умолчанию.
	Ignore []string `json:"ignore,omitempty"`
	// IncludeHidden — включать имена, начинающиеся с точки.
	IncludeHidden bool `json:"include_hidden,omitempty"`
}

// Stats — что именно попало в карту; фронтенд показывает это до импорта.
type Stats struct {
	Dirs      int  `json:"dirs"`
	Files     int  `json:"files"`
	Markdown  int  `json:"markdown"`
	XMind     int  `json:"xmind"`
	Nodes     int  `json:"nodes"`
	Truncated bool `json:"truncated"`
}

type scanner struct {
	opts     Options
	ignore   map[string]bool
	maxDepth int
	maxNodes int
	stats    Stats
}

func newScanner(opts Options) *scanner {
	ignore := make(map[string]bool, len(DefaultIgnore)+len(opts.Ignore))
	for _, name := range DefaultIgnore {
		ignore[strings.ToLower(name)] = true
	}
	for _, name := range opts.Ignore {
		name = strings.ToLower(strings.TrimSpace(name))
		if name != "" {
			ignore[name] = true
		}
	}
	maxDepth := opts.MaxDepth
	if maxDepth <= 0 {
		maxDepth = DefaultMaxDepth
	}
	maxNodes := opts.MaxNodes
	if maxNodes <= 0 {
		maxNodes = DefaultMaxNodes
	}
	return &scanner{opts: opts, ignore: ignore, maxDepth: maxDepth, maxNodes: maxNodes}
}

// Scan обходит каталог и возвращает корневой узел схемы плюс сводку.
func Scan(root string, opts Options) (*model.Topic, Stats, error) {
	root = strings.TrimSpace(root)
	if root == "" {
		return nil, Stats{}, fmt.Errorf("path is required")
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, Stats{}, fmt.Errorf("bad path: %w", err)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return nil, Stats{}, err
	}
	if !info.IsDir() {
		return nil, Stats{}, fmt.Errorf("%s is not a directory", abs)
	}

	s := newScanner(opts)
	name := filepath.Base(abs)
	rootTopic := &model.Topic{
		ID:        uuid.New().String(),
		Title:     name,
		Notes:     abs,
		Structure: "mindmap",
		Icon:      "Home",
	}
	s.stats.Nodes = 1
	children, _ := s.walk(abs, 1)
	rootTopic.Children = children
	rootTopic.Body = summary(s.stats)
	return rootTopic, s.stats, nil
}

// ScanWorkbook — та же схема, но сразу отдельной книгой, готовой к сохранению.
func ScanWorkbook(root string, title string, opts Options) (*model.Workbook, Stats, error) {
	topic, stats, err := Scan(root, opts)
	if err != nil {
		return nil, stats, err
	}
	if strings.TrimSpace(title) == "" {
		title = topic.Title
	}
	wb := model.NewWorkbook(title)
	sheet := model.NewSheet(topic.Title)
	sheet.RootTopic = topic
	wb.AddSheet(sheet)
	return wb, stats, nil
}

func summary(s Stats) string {
	parts := []string{fmt.Sprintf("папок: %d", s.Dirs), fmt.Sprintf("файлов: %d", s.Files)}
	if s.Markdown > 0 {
		parts = append(parts, fmt.Sprintf(".md: %d", s.Markdown))
	}
	if s.XMind > 0 {
		parts = append(parts, fmt.Sprintf(".xmind: %d", s.XMind))
	}
	return strings.Join(parts, " · ")
}

func (s *scanner) skipName(name string) bool {
	if !s.opts.IncludeHidden && strings.HasPrefix(name, ".") {
		return true
	}
	return s.ignore[strings.ToLower(name)]
}

// walk возвращает узлы каталога и признак «здесь есть документ» — по нему в
// режиме DocsOnly отбрасываются ветки без единого .md/.xmind.
func (s *scanner) walk(dir string, depth int) ([]*model.Topic, bool) {
	if depth > s.maxDepth {
		return nil, false
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		// Нечитаемый каталог не должен рушить всю схему.
		return nil, false
	}
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].IsDir() != entries[j].IsDir() {
			return entries[i].IsDir()
		}
		return strings.ToLower(entries[i].Name()) < strings.ToLower(entries[j].Name())
	})

	var out []*model.Topic
	hasDocs := false
	shown := 0
	for _, entry := range entries {
		name := entry.Name()
		if s.skipName(name) {
			continue
		}
		if s.stats.Nodes >= s.maxNodes {
			s.stats.Truncated = true
			break
		}
		if shown >= maxChildrenShown {
			s.stats.Truncated = true
			out = append(out, s.node(fmt.Sprintf("… ещё записи в %s", filepath.Base(dir)), "", ""))
			break
		}

		full := filepath.Join(dir, name)
		if entry.IsDir() {
			children, childDocs := s.walk(full, depth+1)
			if s.opts.DocsOnly && !childDocs {
				continue
			}
			node := s.node(name, full, "")
			node.Icon = "Bookmark"
			node.Children = children
			// Глубокие ветки сворачиваем: схема должна открываться читаемой,
			// а не стеной из тысяч узлов.
			node.Folded = depth >= 3 && len(children) > 0
			out = append(out, node)
			s.stats.Dirs++
			s.stats.Nodes++
			hasDocs = hasDocs || childDocs
			shown++
			continue
		}

		ext := strings.ToLower(filepath.Ext(name))
		kind := DocExtensions[ext]
		if s.opts.DocsOnly && kind == "" {
			continue
		}
		node := s.node(name, full, kind)
		out = append(out, node)
		s.stats.Files++
		s.stats.Nodes++
		shown++
		switch kind {
		case "markdown":
			s.stats.Markdown++
			hasDocs = true
		case "xmind":
			s.stats.XMind++
			hasDocs = true
		}
	}
	return out, hasDocs
}

func (s *scanner) node(title, path, kind string) *model.Topic {
	t := &model.Topic{ID: uuid.New().String(), Title: title, Notes: path}
	switch kind {
	case "markdown":
		// Ссылка на файл — это и есть «открыть как карту»: узел схемы ведёт
		// в тот формат, в котором проект уже описан.
		t.Hyperlink = path
		t.Labels = []string{"markdown"}
		t.Icon = "FileText"
	case "xmind":
		t.Hyperlink = path
		t.Labels = []string{"xmind"}
		t.Icon = "Brain"
	}
	return t
}
