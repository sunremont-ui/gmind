package project

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// bigTree раскладывает дерево width^depth каталогов с файлами в каждом:
// нужен и бенчмарку, и проверке потолка по времени.
func bigTree(tb testing.TB, depth, width, filesPerDir int) string {
	tb.Helper()
	root := tb.TempDir()
	var build func(dir string, level int)
	build = func(dir string, level int) {
		for i := 0; i < filesPerDir; i++ {
			name := fmt.Sprintf("file%02d.md", i)
			if err := os.WriteFile(filepath.Join(dir, name), []byte("# заголовок"), 0o644); err != nil {
				tb.Fatal(err)
			}
		}
		if level <= 0 {
			return
		}
		for i := 0; i < width; i++ {
			sub := filepath.Join(dir, fmt.Sprintf("dir%02d", i))
			if err := os.Mkdir(sub, 0o755); err != nil {
				tb.Fatal(err)
			}
			build(sub, level-1)
		}
	}
	build(root, depth)
	return root
}

func BenchmarkScanProject(b *testing.B) {
	root := bigTree(b, 4, 4, 6)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := Scan(root, Options{MaxNodes: 100000, MaxDepth: 12}); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkScanProjectDocsOnly(b *testing.B) {
	root := bigTree(b, 4, 4, 6)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := Scan(root, Options{DocsOnly: true, MaxNodes: 100000, MaxDepth: 12}); err != nil {
			b.Fatal(err)
		}
	}
}

// Схема должна собираться, пока пользователь не успел передумать. Порог
// нарочно щедрый — тест ловит не микросекунды, а возврат к обходу, который
// читает содержимое файлов или ходит по дереву многократно.
func TestScanLargeTreeStaysFast(t *testing.T) {
	if testing.Short() {
		t.Skip("создаёт ~1400 файлов на диске")
	}
	root := bigTree(t, 4, 4, 6)

	started := time.Now()
	topic, stats, err := Scan(root, Options{MaxNodes: 100000, MaxDepth: 12})
	elapsed := time.Since(started)
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if stats.Nodes < 1000 {
		t.Fatalf("дерево должно быть большим: %+v", stats)
	}
	if countTopics(topic) != stats.Nodes {
		t.Errorf("узлов в карте %d, в сводке %d — счётчик разошёлся с деревом",
			countTopics(topic), stats.Nodes)
	}
	if elapsed > 5*time.Second {
		t.Errorf("обход %d узлов занял %s — слишком долго", stats.Nodes, elapsed)
	}
}

// Потолок узлов обязан держать карту в разумных пределах независимо от того,
// сколько файлов лежит на диске: без него схема большого репозитория вешает
// отрисовку.
func TestScanNodeCapHoldsOnLargeTree(t *testing.T) {
	if testing.Short() {
		t.Skip("создаёт ~1400 файлов на диске")
	}
	root := bigTree(t, 4, 4, 6)

	topic, stats, err := Scan(root, Options{MaxNodes: 500, MaxDepth: 12})
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if !stats.Truncated {
		t.Error("карта должна быть помечена усечённой")
	}
	// Потолок проверяется перед добавлением узла, плюс служебные «… ещё».
	if got := countTopics(topic); got > 600 {
		t.Errorf("узлов %d при потолке 500", got)
	}
}
