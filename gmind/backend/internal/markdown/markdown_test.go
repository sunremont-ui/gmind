package markdown

import (
	"reflect"
	"strings"
	"testing"

	"github.com/gmind/backend/internal/model"
)

func TestParseHeadings(t *testing.T) {
	root := Parse("# Root\n\n## A\n\n## B\n\n### B1\n", "fallback")
	if root.Title != "Root" {
		t.Fatalf("root title = %q, want Root", root.Title)
	}
	if len(root.Children) != 2 {
		t.Fatalf("root children = %d, want 2", len(root.Children))
	}
	if root.Children[1].Title != "B" || len(root.Children[1].Children) != 1 {
		t.Fatalf("B subtree wrong: %+v", root.Children[1])
	}
	if root.Children[1].Children[0].Title != "B1" {
		t.Fatalf("B1 missing")
	}
}

func TestParseBodyAndNotes(t *testing.T) {
	src := "# Root\n\nПервая строка тела.\nВторая строка.\n\n> заметка\n\n## Child\n"
	root := Parse(src, "x")
	if root.Body != "Первая строка тела.\nВторая строка." {
		t.Fatalf("body = %q", root.Body)
	}
	if root.Notes != "заметка" {
		t.Fatalf("notes = %q", root.Notes)
	}
	if len(root.Children) != 1 || root.Children[0].Title != "Child" {
		t.Fatalf("child lost: %+v", root.Children)
	}
}

func TestParseListsUnderHeading(t *testing.T) {
	src := "# Root\n\n## Section\n\n- one\n- two\n  - two-a\n"
	root := Parse(src, "x")
	sec := root.Children[0]
	if len(sec.Children) != 2 {
		t.Fatalf("section children = %d, want 2", len(sec.Children))
	}
	if sec.Children[1].Title != "two" || len(sec.Children[1].Children) != 1 {
		t.Fatalf("nested list wrong: %+v", sec.Children[1])
	}
	if sec.Children[1].Children[0].Title != "two-a" {
		t.Fatalf("two-a missing")
	}
}

func TestParseMultipleRootsGetsSyntheticRoot(t *testing.T) {
	root := Parse("# One\n\n# Two\n", "Мой файл")
	if root.Title != "Мой файл" {
		t.Fatalf("synthetic root title = %q", root.Title)
	}
	if len(root.Children) != 2 {
		t.Fatalf("children = %d, want 2", len(root.Children))
	}
}

func TestParseEmptyGivesFallbackRoot(t *testing.T) {
	root := Parse("   \n\n", "Пусто")
	if root.Title != "Пусто" || len(root.Children) != 0 {
		t.Fatalf("empty parse = %+v", root)
	}
}

func TestParseFrontMatterStripped(t *testing.T) {
	root := Parse("---\ntitle: X\n---\n\n# Root\n", "x")
	if root.Title != "Root" {
		t.Fatalf("front matter leaked: %q", root.Title)
	}
}

func TestParseMeta(t *testing.T) {
	src := "# Root\n\n<!-- gmind: {\"shape\":\"hexagon\",\"icon\":\"Star\",\"memory_kind\":\"semantic\"} -->\n"
	root := Parse(src, "x")
	if root.Shape != "hexagon" || root.Icon != "Star" || root.MemoryKind != "semantic" {
		t.Fatalf("meta not applied: %+v", root)
	}
}

func TestParseCodeFenceStaysInBody(t *testing.T) {
	src := "# Root\n\n```go\n// # not a heading\nfunc main() {}\n```\n"
	root := Parse(src, "x")
	if len(root.Children) != 0 {
		t.Fatalf("fence produced children: %+v", root.Children)
	}
	if !strings.Contains(root.Body, "func main()") {
		t.Fatalf("fence body lost: %q", root.Body)
	}
}

func TestRenderRoundTrip(t *testing.T) {
	root := &model.Topic{
		ID: "1", Title: "Корень", Body: "тело корня", Notes: "заметка", Shape: "hexagon",
		Children: []*model.Topic{
			{ID: "2", Title: "Ребёнок", Body: "тело ребёнка"},
			{ID: "3", Title: "Второй", Children: []*model.Topic{
				{ID: "4", Title: "Внук", MemoryKind: "episodic"},
			}},
		},
	}
	md := Render(root)
	back := Parse(md, "fallback")

	if back.Title != "Корень" || back.Body != "тело корня" || back.Notes != "заметка" || back.Shape != "hexagon" {
		t.Fatalf("root round-trip lost data: %+v\n---\n%s", back, md)
	}
	if len(back.Children) != 2 {
		t.Fatalf("children = %d, want 2\n%s", len(back.Children), md)
	}
	if back.Children[0].Body != "тело ребёнка" {
		t.Fatalf("child body = %q", back.Children[0].Body)
	}
	if back.Children[1].Children[0].MemoryKind != "episodic" {
		t.Fatalf("grandchild meta lost: %+v", back.Children[1].Children[0])
	}
}

func TestRenderStableOnSecondPass(t *testing.T) {
	src := "# Root\n\nтело\n\n## A\n\n- l1\n  - l2\n"
	once := Render(Parse(src, "x"))
	twice := Render(Parse(once, "x"))
	if once != twice {
		t.Fatalf("render not stable:\n--- once ---\n%s\n--- twice ---\n%s", once, twice)
	}
}

func TestBodyWithMarkdownSyntaxSurvives(t *testing.T) {
	root := &model.Topic{ID: "1", Title: "Root", Body: "- не узел, а строка тела\n# тоже не заголовок"}
	back := Parse(Render(root), "x")
	if len(back.Children) != 0 {
		t.Fatalf("body leaked into children: %+v", back.Children)
	}
	if back.Body != root.Body {
		t.Fatalf("body = %q, want %q", back.Body, root.Body)
	}
}

func TestDeepTreeUsesLists(t *testing.T) {
	// 8 уровней: первые шесть — заголовки, дальше вложенные списки.
	leaf := &model.Topic{ID: "8", Title: "L8"}
	node := leaf
	for i := 7; i >= 1; i-- {
		node = &model.Topic{ID: string(rune('0' + i)), Title: "L" + string(rune('0'+i)), Children: []*model.Topic{node}}
	}
	md := Render(node)
	if !strings.Contains(md, "###### L6") {
		t.Fatalf("no level-6 heading:\n%s", md)
	}
	if !strings.Contains(md, "- L7") || !strings.Contains(md, "  - L8") {
		t.Fatalf("deep levels not lists:\n%s", md)
	}
	back := Parse(md, "x")
	depth := 0
	for n := back; n != nil; depth++ {
		if len(n.Children) == 0 {
			break
		}
		n = n.Children[0]
	}
	if depth != 7 {
		t.Fatalf("round-trip depth = %d, want 7\n%s", depth, md)
	}
}

func TestListsStayListsOnSave(t *testing.T) {
	src := "# Root\n\n## Раздел\n\n- один\n- два\n  - два-а\n"
	out := Render(Parse(src, "x"))

	if strings.Contains(out, "### один") || strings.Contains(out, "#### два-а") {
		t.Fatalf("список переписан в заголовки:\n%s", out)
	}
	if !strings.Contains(out, "- один") || !strings.Contains(out, "  - два-а") {
		t.Fatalf("вложенность списка потеряна:\n%s", out)
	}
	if !strings.Contains(out, "## Раздел") {
		t.Fatalf("заголовок стал не заголовком:\n%s", out)
	}
}

func TestNewNodeUnderListStaysInList(t *testing.T) {
	// Узел, дописанный в приложении к пункту списка, не должен ломать список
	// заголовком посреди него.
	root := Parse("# Root\n\n- пункт\n", "x")
	item := root.Children[0]
	item.Children = append(item.Children, &model.Topic{ID: "new", Title: "новый"})

	out := Render(root)
	if strings.Contains(out, "### новый") {
		t.Fatalf("новый узел внутри списка отрендерен заголовком:\n%s", out)
	}
	if !strings.Contains(out, "  - новый") {
		t.Fatalf("новый узел не стал вложенным пунктом:\n%s", out)
	}
}

func TestRenderHasNoTripleBlankLines(t *testing.T) {
	root := Parse("# Root\n\nтело\n\n> заметка\n\n## A\n\n## B\n", "x")
	root.Shape = "hexagon"
	out := Render(root)
	if strings.Contains(out, "\n\n\n") {
		t.Fatalf("в файле лишние пустые строки:\n%q", out)
	}
}

func TestParseTextBeforeHeading(t *testing.T) {
	root := Parse("свободный текст\n\n# Заголовок\n", "x")
	if root.Title != "x" {
		t.Fatalf("expected synthetic root, got %q", root.Title)
	}
	if len(root.Children) != 2 {
		t.Fatalf("children = %d, want 2 (текст + заголовок)", len(root.Children))
	}
}

// ─────────── сторожа сохранности: цикл Render → Parse ───────────

// TestRoundTripKeepsEmptyTitledNode: узел без заголовка не должен исчезать.
//
// Регрессия, стоившая 34 узлов из 791 на настоящих книгах: рендер писал «## »,
// разбор обрезал хвостовой пробел, и строка «##» переставала быть заголовком —
// узел пропадал, а его решётки оседали в теле соседа.
func TestRoundTripKeepsEmptyTitledNode(t *testing.T) {
	root := &model.Topic{ID: "r", Title: "Корень", Children: []*model.Topic{
		{ID: "a", Title: ""},
		{ID: "b", Title: "После пустого"},
	}}

	got := Parse(Render(root), "")

	if len(got.Children) != 2 {
		t.Fatalf("детей = %d, want 2 (узел с пустым заголовком исчез): %s", len(got.Children), Render(root))
	}
	if got.Children[0].Title != "" {
		t.Errorf("пустой заголовок стал %q — разбор подменил данные", got.Children[0].Title)
	}
	if got.Children[1].Title != "После пустого" {
		t.Errorf("соседний узел = %q", got.Children[1].Title)
	}
	if strings.Contains(got.Children[1].Body, "#") {
		t.Errorf("решётки пропавшего узла осели в теле соседа: %q", got.Children[1].Body)
	}
}

// TestRoundTripKeepsEmptyListItem — то же для узла, записанного пунктом списка.
func TestRoundTripKeepsEmptyListItem(t *testing.T) {
	root := &model.Topic{ID: "r", Title: "Корень", Children: []*model.Topic{
		{ID: "a", Title: "Раздел", MdForm: FormList, Children: []*model.Topic{
			{ID: "a1", Title: "", MdForm: FormList},
			{ID: "a2", Title: "второй", MdForm: FormList},
		}},
	}}

	got := Parse(Render(root), "")

	if len(got.Children) != 1 || len(got.Children[0].Children) != 2 {
		t.Fatalf("пункт без текста потерян, вышло: %q", Render(root))
	}
}

// TestHeadingPatternDoesNotEatHashtags: послабление образца заголовка не должно
// превращать «#хэштег» в заголовок, а «---» — в пункт списка. Ровно эти две
// строки и были причиной, по которой текст после маркера сделан необязательным
// вместе с пробелом, а не отдельно от него.
func TestHeadingPatternDoesNotEatHashtags(t *testing.T) {
	for _, line := range []string{"#хэштег", "#1", "###тема"} {
		if headingRe.MatchString(line) {
			t.Errorf("%q ошибочно распознана как заголовок", line)
		}
	}
	for _, line := range []string{"---", "***", "--"} {
		if listItemRe.MatchString(line) {
			t.Errorf("%q ошибочно распознана как пункт списка", line)
		}
	}
	for _, line := range []string{"#", "##", "###### "} {
		if !headingRe.MatchString(strings.TrimRight(line, " ")) {
			t.Errorf("%q должна быть заголовком без текста", line)
		}
	}
	for _, line := range []string{"-", "*", "  -", "1."} {
		if !listItemRe.MatchString(line) {
			t.Errorf("%q должна быть пунктом без текста", line)
		}
	}
}

// TestRoundTripKeepsEveryTopicField — главный сторож.
//
// Проходит по ВСЕМ полям model.Topic рефлексией, заполняет каждое ненулевым
// значением и проверяет, что оно вернулось после цикла. Список полей руками
// здесь неуместен: именно молчаливое отсутствие поля в Meta и было дефектом —
// поле добавляли в модель, забывали в сериализации, и сохранение начинало
// терять его, не ломая ни одного теста.
//
// Поля, которые цикл сознательно не переносит, перечислены в skip с причиной.
// Список именно ИСКЛЮЧЕНИЙ, а не включений: новое поле модели по умолчанию
// попадает под проверку и роняет тест, пока о нём не примут решения.
func TestRoundTripKeepsEveryTopicField(t *testing.T) {
	skip := map[string]string{
		"Children":     "не свойство узла, а само дерево — проверяется отдельными тестами",
		"ID":           "не пишется в файл осознанно: meta под каждым узлом сделала бы Markdown нечитаемым",
		"CommentCount": "производное от таблицы комментариев, а не свойство узла",
		"MdForm":       "восстанавливается из формы записи; хранить вторым экземпляром — два источника правды",
		"Position":     "проверяется ниже отдельно: указатель, требует сравнения по значению",
		"MasysRef":     "проверяется ниже отдельно: указатель, требует сравнения по значению",
	}

	rt := reflect.TypeOf(model.Topic{})
	for i := 0; i < rt.NumField(); i++ {
		field := rt.Field(i)
		if reason, ok := skip[field.Name]; ok {
			t.Logf("пропущено %s: %s", field.Name, reason)
			continue
		}

		topic := &model.Topic{ID: "n1", Title: "Узел"}
		value := reflect.ValueOf(topic).Elem().FieldByName(field.Name)
		want := probeValue(field)
		if !want.IsValid() {
			t.Fatalf("для поля %s (%s) нет пробного значения — допишите probeValue", field.Name, field.Type)
		}
		value.Set(want)

		got := Parse(Render(topic), "")
		back := reflect.ValueOf(*got).FieldByName(field.Name)

		if !reflect.DeepEqual(back.Interface(), want.Interface()) {
			t.Errorf("поле %s: было %v, вернулось %v — при сохранении в .md теряется",
				field.Name, want.Interface(), back.Interface())
		}
	}
}

// probeValue — неотличимое от нуля значение для поля любого типа. Строки не
// произвольные: заголовок и тело участвуют в разборе, и подставить туда «x»
// значило бы проверить не то.
func probeValue(field reflect.StructField) reflect.Value {
	switch field.Name {
	case "Title":
		return reflect.ValueOf("Заголовок узла")
	case "Body":
		return reflect.ValueOf("Тело узла")
	case "Notes":
		return reflect.ValueOf("Заметка узла")
	}
	switch field.Type.Kind() {
	case reflect.String:
		return reflect.ValueOf("проба")
	case reflect.Int:
		return reflect.ValueOf(7)
	case reflect.Float64:
		return reflect.ValueOf(0.5)
	case reflect.Bool:
		return reflect.ValueOf(true)
	case reflect.Slice:
		if field.Type.Elem().Kind() == reflect.String {
			return reflect.ValueOf([]string{"проба"})
		}
	}
	return reflect.Value{}
}

// TestRoundTripKeepsPointerFields — Position и MasysRef: указатели, у которых
// важно значение, а не адрес.
func TestRoundTripKeepsPointerFields(t *testing.T) {
	topic := &model.Topic{
		ID:       "n1",
		Title:    "Узел",
		Position: &model.Position{X: 12.5, Y: -3},
		MasysRef: &model.MasysRef{Namespace: "gmind", Kind: "concept", Key: "память"},
	}

	got := Parse(Render(topic), "")

	if got.Position == nil || *got.Position != *topic.Position {
		t.Errorf("Position: было %+v, вернулось %+v", topic.Position, got.Position)
	}
	if got.MasysRef == nil || *got.MasysRef != *topic.MasysRef {
		t.Errorf("MasysRef: было %+v, вернулось %+v", topic.MasysRef, got.MasysRef)
	}
}
