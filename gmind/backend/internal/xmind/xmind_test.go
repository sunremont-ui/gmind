package xmind

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"

	"github.com/gmind/backend/internal/model"
)

func sampleWorkbook() *model.Workbook {
	root := &model.Topic{
		ID:         "root",
		Title:      "Проект",
		Body:       "тело корневого узла\nвторая строка",
		Notes:      "заметка",
		Labels:     []string{"проект"},
		Markers:    []string{"star"},
		Structure:  "mindmap",
		Shape:      "hexagon",
		MemoryKind: "semantic",
		FontSize:   18,
		Children: []*model.Topic{
			{
				ID:        "a",
				Title:     "Ветка A",
				Body:      "описание ветки",
				ChildDir:  "up-right",
				Hyperlink: "D:/проект/docs/plan.md",
				Icon:      "FileText",
				Folded:    true,
				Children: []*model.Topic{
					{ID: "a1", Title: "Лист A1", RichText: "<b>Лист A1</b>"},
				},
			},
			{ID: "b", Title: "Ветка B", NodeWidth: 220, BorderColor: "#5B6CFF"},
		},
	}
	sheet := &model.Sheet{
		ID:        "sheet-1",
		Title:     "Лист",
		RootTopic: root,
		Relationships: []*model.Relationship{
			{
				ID: "rel-1", Title: "зависит", End1ID: "a", End2ID: "b",
				Type: "depends_on", Direction: "forward", Color: "#FF0000",
				Style: "dashed", Weight: 0.8,
			},
		},
	}
	wb := model.NewWorkbook("Проект")
	wb.AddSheet(sheet)
	return wb
}

func findByID(t *model.Topic, id string) *model.Topic {
	if t == nil {
		return nil
	}
	if t.ID == id {
		return t
	}
	for _, c := range t.Children {
		if found := findByID(c, id); found != nil {
			return found
		}
	}
	return nil
}

func roundTrip(t *testing.T, wb *model.Workbook) *model.Workbook {
	t.Helper()
	data, err := Export(wb)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	sheets, err := ParseXMind(data)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	return ConvertToWorkbook(sheets, wb.Title)
}

func TestExportProducesReadableArchive(t *testing.T) {
	data, err := Export(sampleWorkbook())
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("файл .xmind должен быть zip-архивом: %v", err)
	}
	want := map[string]bool{"content.json": false, "manifest.json": false, "META-INF/manifest.xml": false}
	for _, f := range zr.File {
		if _, ok := want[f.Name]; ok {
			want[f.Name] = true
		}
	}
	for name, found := range want {
		if !found {
			t.Errorf("в архиве нет %s", name)
		}
	}
}

func TestRoundTripKeepsTreeShape(t *testing.T) {
	got := roundTrip(t, sampleWorkbook())

	if len(got.Sheets) != 1 {
		t.Fatalf("листов %d, want 1", len(got.Sheets))
	}
	root := got.Sheets[0].RootTopic
	if root.Title != "Проект" || len(root.Children) != 2 {
		t.Fatalf("корень = %+v", root)
	}
	a := findByID(root, "a")
	if a == nil || len(a.Children) != 1 || a.Children[0].Title != "Лист A1" {
		t.Fatalf("ветка A потеряла поддерево: %+v", a)
	}
	if !a.Folded {
		t.Error("свёрнутость узла должна пережить обмен")
	}
	if root.Notes != "заметка" || len(root.Labels) != 1 || len(root.Markers) != 1 {
		t.Errorf("стандартные поля потеряны: %+v", root)
	}
}

func TestRoundTripKeepsNodeText(t *testing.T) {
	// Тело узла — основной текст модели «голова + тело». Ровно эти данные
	// теряло сохранение в .md, и терять их в .xmind тем более нельзя.
	got := roundTrip(t, sampleWorkbook())
	root := got.Sheets[0].RootTopic

	if root.Body != "тело корневого узла\nвторая строка" {
		t.Errorf("тело корня = %q", root.Body)
	}
	if a := findByID(root, "a"); a == nil || a.Body != "описание ветки" {
		t.Errorf("тело ветки = %+v", a)
	}
	if a1 := findByID(root, "a1"); a1 == nil || a1.RichText != "<b>Лист A1</b>" {
		t.Errorf("оформление головы потеряно: %+v", a1)
	}
}

func TestRoundTripKeepsNodeAppearanceAndLinks(t *testing.T) {
	got := roundTrip(t, sampleWorkbook())
	root := got.Sheets[0].RootTopic

	if root.Shape != "hexagon" || root.MemoryKind != "semantic" || root.FontSize != 18 {
		t.Errorf("оформление корня потеряно: shape=%q kind=%q font=%d",
			root.Shape, root.MemoryKind, root.FontSize)
	}
	a := findByID(root, "a")
	if a == nil || a.Hyperlink != "D:/проект/docs/plan.md" {
		t.Errorf("ссылка на файл потеряна: %+v", a)
	}
	if a == nil || a.ChildDir != "up-right" {
		t.Errorf("направление ветки потеряно: %+v", a)
	}
	b := findByID(root, "b")
	if b == nil || b.NodeWidth != 220 || b.BorderColor != "#5B6CFF" {
		t.Errorf("размеры и цвет узла потеряны: %+v", b)
	}
}

func TestRoundTripKeepsTypedRelationships(t *testing.T) {
	got := roundTrip(t, sampleWorkbook())
	rels := got.Sheets[0].Relationships
	if len(rels) != 1 {
		t.Fatalf("связей %d, want 1", len(rels))
	}
	rel := rels[0]
	if rel.End1ID != "a" || rel.End2ID != "b" || rel.Title != "зависит" {
		t.Fatalf("концы связи потеряны: %+v", rel)
	}
	if rel.Type != "depends_on" || rel.Direction != "forward" {
		t.Errorf("тип и направление связи потеряны: type=%q dir=%q", rel.Type, rel.Direction)
	}
	if rel.Color != "#FF0000" || rel.Style != "dashed" || rel.Weight != 0.8 {
		t.Errorf("оформление связи потеряно: %+v", rel)
	}
}

func TestParseAcceptsBothContentShapes(t *testing.T) {
	object := `{"version":"2.0","sheets":[{"id":"s","title":"Лист","topic":{"id":"r","title":"Корень"}}]}`
	array := `[{"id":"s","title":"Лист","topic":{"id":"r","title":"Корень","children":{"attached":[{"id":"c","title":"Дитя"}]}}}]`

	for name, content := range map[string]string{"объект": object, "массив": array} {
		sheets, err := ParseXMind(zipWith(t, "content.json", content))
		if err != nil {
			t.Fatalf("%s: parse: %v", name, err)
		}
		if len(sheets) != 1 || sheets[0].Topic.Title != "Корень" {
			t.Fatalf("%s: sheets = %+v", name, sheets)
		}
	}
}

func TestParseRejectsBrokenFiles(t *testing.T) {
	if _, err := ParseXMind([]byte("не zip")); err == nil {
		t.Error("не-zip должен быть ошибкой")
	}
	if _, err := ParseXMind(zipWith(t, "readme.txt", "нет content.json")); err == nil {
		t.Error("архив без content.json должен быть ошибкой")
	}
	if _, err := ParseXMind(zipWith(t, "content.json", "{сломано")); err == nil {
		t.Error("битый JSON должен быть ошибкой")
	}
	_, err := ParseXMind(zipWith(t, "content.json", "{сломано"))
	if err != nil && !strings.Contains(err.Error(), "content.json") {
		t.Errorf("ошибка должна называть источник: %v", err)
	}
}

func TestExportHandlesEmptyWorkbook(t *testing.T) {
	wb := model.NewWorkbook("пусто")
	data, err := Export(wb)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	sheets, err := ParseXMind(data)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(sheets) != 0 {
		t.Errorf("листов %d, want 0", len(sheets))
	}
}

// zipWith собирает минимальный архив с одним файлом внутри.
func zipWith(t *testing.T, name, content string) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, err := zw.Create(name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := io.WriteString(f, content); err != nil {
		t.Fatal(err)
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// contentOf достаёт content.json из архива — помогает разбирать падения.
func contentOf(t *testing.T, data []byte) map[string]any {
	t.Helper()
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range zr.File {
		if f.Name != "content.json" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		defer rc.Close()
		raw, err := io.ReadAll(rc)
		if err != nil {
			t.Fatal(err)
		}
		var out map[string]any
		if err := json.Unmarshal(raw, &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	t.Fatal("content.json not found")
	return nil
}

func TestExportKeepsStandardXMindFields(t *testing.T) {
	// Совместимость: обычный XMind должен находить заголовки на своих местах,
	// поэтому расширение Gmind живёт в отдельном поле, а не подменяет схему.
	content := contentOf(t, mustExport(t, sampleWorkbook()))
	sheets, ok := content["sheets"].([]any)
	if !ok || len(sheets) == 0 {
		t.Fatalf("sheets = %v", content["sheets"])
	}
	sheet := sheets[0].(map[string]any)
	topic := sheet["topic"].(map[string]any)
	if topic["title"] != "Проект" {
		t.Errorf("title = %v", topic["title"])
	}
	if _, ok := topic["children"]; !ok {
		t.Error("дети должны лежать в стандартном children.attached")
	}
}

func mustExport(t *testing.T, wb *model.Workbook) []byte {
	t.Helper()
	data, err := Export(wb)
	if err != nil {
		t.Fatalf("export: %v", err)
	}
	return data
}
