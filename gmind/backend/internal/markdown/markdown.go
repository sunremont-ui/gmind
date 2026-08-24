// Package markdown converts between Markdown documents and Gmind topic trees.
//
// Формат — обычный Markdown, который читается человеком и другими редакторами:
//
//	# Корень
//
//	Тело корневого узла (модель «голова + тело»).
//
//	> Заметка узла
//
//	<!-- gmind: {"shape":"hexagon","icon":"Star"} -->
//
//	## Ребёнок
//
//	- Лист
//	  - Вложенный лист
//
// Заголовок → «голова» узла (Title), абзацы под ним → «тело» (Body),
// цитата → Notes, HTML-комментарий `gmind:` → визуальные свойства узла.
// Разбор и сборка симметричны: Render(Parse(x)) стабилен на втором проходе.
package markdown

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"github.com/gmind/backend/internal/model"
)

// MaxHeadingLevel — глубже шестого уровня Markdown заголовков нет,
// дальше дерево продолжается вложенными списками.
const MaxHeadingLevel = 6

// Форма записи узла в файле. Хранится в Topic.MdForm, чтобы сохранение
// не переписывало авторские списки в заголовки и наоборот.
const (
	FormHeading = "heading"
	FormList    = "list"
)

// ⚠️ Текст после маркера НЕОБЯЗАТЕЛЕН, и это исправление потери данных, а не
// послабление разбора. Узел с пустым заголовком рендерился в строку `## `,
// разбор обрезал хвостовой пробел, `##` под прежний образец (требовавший `\s+`)
// не подходил — и узел не просто терял заголовок, а исчезал целиком, оставляя
// «##» в теле соседа. На книгах машины так пропадало 34 узла из 791.
//
// Необязательной сделана именно группа с ПРОБЕЛОМ И ТЕКСТОМ, а не пробел
// отдельно: образец `^(#{1,6})\s*(.*)$` превратил бы в заголовок первого уровня
// любой «#хэштег» в тексте, а `^(\s*)([-*+])\s*(.*)$` — строку «---» в пункт
// списка. Здесь после маркера обязан идти либо пробел с текстом, либо конец строки.
var (
	headingRe   = regexp.MustCompile(`^(#{1,6})(?:[ \t]+(.*))?$`)
	listItemRe  = regexp.MustCompile(`^(\s*)(?:[-*+]|\d+[.)])(?:[ \t]+(.*))?$`)
	metaRe      = regexp.MustCompile(`^<!--\s*gmind:\s*(\{.*\})\s*-->$`)
	fenceRe     = regexp.MustCompile("^\\s*(```|~~~)")
	frontDelimR = regexp.MustCompile(`^---\s*$`)
)

// Meta — визуальные и семантические свойства узла, которые нельзя выразить
// синтаксисом Markdown. Сохраняются в HTML-комментарии рядом с узлом.
//
// ⚠️ Поле модели, которого здесь нет, при сохранении карты в .md пропадает
// молча. Замер map-roundtrip-loss на настоящих книгах показал цену такого
// умолчания: из свойств формы доходило 32.9%, а гиперссылки узлов (62 значения,
// все — вложения записей мастера) терялись полностью. Поэтому список ведётся
// по модели, а не по тому, что «казалось важным».
//
// Чего здесь по-прежнему нет и почему:
//   - ID — идентификатор узла. Записать его значило бы поставить meta-комментарий
//     под КАЖДЫЙ узел файла, превратив читаемый Markdown в разметку с UUID на
//     каждой строке. Цена — вид файла, выигрыш — устойчивая ссылка на узел,
//     которой сегодня никто не пользуется; решение отложено осознанно.
//   - CommentCount — производное от таблицы комментариев, а не свойство узла.
//   - MdForm — восстанавливается разбором из самой формы записи (заголовок или
//     пункт), хранить его вторым экземпляром значило бы завести два источника
//     правды об одном.
type Meta struct {
	Shape      string          `json:"shape,omitempty"`
	Icon       string          `json:"icon,omitempty"`
	NodeStyle  string          `json:"node_style,omitempty"`
	FontColor  string          `json:"font_color,omitempty"`
	BorderCol  string          `json:"border_color,omitempty"`
	MemoryKind string          `json:"memory_kind,omitempty"`
	MasysRef   *model.MasysRef `json:"masys_ref,omitempty"`
	Markers    []string        `json:"markers,omitempty"`
	Labels     []string        `json:"labels,omitempty"`
	Progress   int             `json:"progress,omitempty"`
	Priority   int             `json:"priority,omitempty"`
	Folded     bool            `json:"folded,omitempty"`
	Image      string          `json:"image,omitempty"`
	Position   *model.Position `json:"position,omitempty"`
	ChildDir   string          `json:"child_dir,omitempty"`
	Structure  string          `json:"structure_class,omitempty"`
	RichText   string          `json:"rich_text,omitempty"`

	// Ссылка и вложение узла. Гиперссылка — самая дорогая из прежних потерь:
	// именно ею записи мастера ссылаются на свои файлы.
	Hyperlink string `json:"hyperlink,omitempty"`

	// Геометрия и шрифт.
	NodeWidth   int     `json:"node_width,omitempty"`
	NodeHeight  int     `json:"node_height,omitempty"`
	FontSize    int     `json:"font_size,omitempty"`
	FontFamily  string  `json:"font_family,omitempty"`
	FontWeight  int     `json:"font_weight,omitempty"`
	TextAlign   string  `json:"text_align,omitempty"`
	BorderWidth int     `json:"border_width,omitempty"`
	Padding     int     `json:"padding,omitempty"`
	Opacity     float64 `json:"opacity,omitempty"`
	ShadowType  string  `json:"shadow_type,omitempty"`

	// Раскладка и ребро к родителю.
	BranchSide   string   `json:"branch_side,omitempty"`
	ParentAnchor string   `json:"parent_anchor,omitempty"`
	EdgeStyle    string   `json:"edge_style,omitempty"`
	EdgeDash     string   `json:"edge_dash,omitempty"`
	EdgeWeight   float64  `json:"edge_weight,omitempty"`
	LevelGap     int      `json:"level_gap,omitempty"`
	SiblingGap   int      `json:"sibling_gap,omitempty"`
	FoldedSides  []string `json:"folded_sides,omitempty"`
	FoldIcon     string   `json:"fold_icon,omitempty"`

	// Прочее, что иначе теряется.
	ConnColor      string `json:"connection_color,omitempty"`
	ShowChildCount bool   `json:"show_child_count,omitempty"`
	CommentIcon    string `json:"comment_icon,omitempty"`
	MasysRunID     string `json:"masys_run_id,omitempty"`
}

func metaOf(t *model.Topic) Meta {
	return Meta{
		Shape:          t.Shape,
		Icon:           t.Icon,
		NodeStyle:      t.NodeStyle,
		FontColor:      t.FontColor,
		BorderCol:      t.BorderColor,
		MemoryKind:     t.MemoryKind,
		MasysRef:       t.MasysRef,
		Markers:        t.Markers,
		Labels:         t.Labels,
		Progress:       t.Progress,
		Priority:       t.Priority,
		Folded:         t.Folded,
		Image:          t.Image,
		Position:       t.Position,
		ChildDir:       t.ChildDir,
		Structure:      t.Structure,
		RichText:       t.RichText,
		Hyperlink:      t.Hyperlink,
		NodeWidth:      t.NodeWidth,
		NodeHeight:     t.NodeHeight,
		FontSize:       t.FontSize,
		FontFamily:     t.FontFamily,
		FontWeight:     t.FontWeight,
		TextAlign:      t.TextAlign,
		BorderWidth:    t.BorderWidth,
		Padding:        t.Padding,
		Opacity:        t.Opacity,
		ShadowType:     t.ShadowType,
		BranchSide:     t.BranchSide,
		ParentAnchor:   t.ParentAnchor,
		EdgeStyle:      t.EdgeStyle,
		EdgeDash:       t.EdgeDash,
		EdgeWeight:     t.EdgeWeight,
		LevelGap:       t.LevelGap,
		SiblingGap:     t.SiblingGap,
		FoldedSides:    t.FoldedSides,
		FoldIcon:       t.FoldIcon,
		ConnColor:      t.ConnColor,
		ShowChildCount: t.ShowChildCount,
		CommentIcon:    t.CommentIcon,
		MasysRunID:     t.MasysRunID,
	}
}

// isEmpty — «в этом узле нечего сохранять сверх текста».
//
// ⚠️ Считается рефлексией, а не перечислением полей. Прежний вариант сверял
// поля вручную, и каждое новое поле Meta нужно было не забыть дописать ещё и
// сюда; забытое поле давало не ошибку сборки, а молчаливую потерю — meta
// считалась пустой и не записывалась вовсе.
func (m Meta) isEmpty() bool {
	return reflect.ValueOf(m).IsZero()
}

func (m Meta) applyTo(t *model.Topic) {
	t.Shape = m.Shape
	t.Icon = m.Icon
	t.NodeStyle = m.NodeStyle
	t.FontColor = m.FontColor
	t.BorderColor = m.BorderCol
	t.MemoryKind = m.MemoryKind
	t.MasysRef = m.MasysRef
	t.Markers = m.Markers
	t.Labels = m.Labels
	t.Progress = m.Progress
	t.Priority = m.Priority
	t.Folded = m.Folded
	t.Image = m.Image
	t.Position = m.Position
	t.ChildDir = m.ChildDir
	t.Structure = m.Structure
	t.RichText = m.RichText
	t.Hyperlink = m.Hyperlink
	t.NodeWidth = m.NodeWidth
	t.NodeHeight = m.NodeHeight
	t.FontSize = m.FontSize
	t.FontFamily = m.FontFamily
	t.FontWeight = m.FontWeight
	t.TextAlign = m.TextAlign
	t.BorderWidth = m.BorderWidth
	t.Padding = m.Padding
	t.Opacity = m.Opacity
	t.ShadowType = m.ShadowType
	t.BranchSide = m.BranchSide
	t.ParentAnchor = m.ParentAnchor
	t.EdgeStyle = m.EdgeStyle
	t.EdgeDash = m.EdgeDash
	t.EdgeWeight = m.EdgeWeight
	t.LevelGap = m.LevelGap
	t.SiblingGap = m.SiblingGap
	t.FoldedSides = m.FoldedSides
	t.FoldIcon = m.FoldIcon
	t.ConnColor = m.ConnColor
	t.ShowChildCount = m.ShowChildCount
	t.CommentIcon = m.CommentIcon
	t.MasysRunID = m.MasysRunID
}

// ─────────────────────────── Parse ───────────────────────────

type parsedNode struct {
	level  int
	topic  *model.Topic
	body   []string
	notes  []string
	inList bool // узел пришёл из списка: тело к нему не приклеиваем
}

// Parse превращает Markdown в дерево топиков и возвращает корень.
//
// Если в документе один узел верхнего уровня — он и становится корнем.
// Иначе создаётся синтетический корень с заголовком fallbackTitle.
func Parse(src, fallbackTitle string) *model.Topic {
	lines := stripFrontMatter(splitLines(src))

	var roots []*parsedNode
	var stack []*parsedNode
	// all — каждый созданный узел разбора: тело/заметки применяем в самом конце,
	// когда все строки уже разложены по своим узлам.
	var all []*parsedNode
	// headingBase — уровень последнего заголовка: от него отсчитывается
	// вложенность пунктов списка, чтобы «- пункт» под «## H2» стал третьим уровнем.
	headingBase := 0
	inFence := false

	attach := func(n *parsedNode) {
		all = append(all, n)
		for len(stack) > 0 && stack[len(stack)-1].level >= n.level {
			stack = stack[:len(stack)-1]
		}
		if len(stack) == 0 {
			roots = append(roots, n)
		} else {
			p := stack[len(stack)-1]
			p.topic.Children = append(p.topic.Children, n.topic)
		}
		stack = append(stack, n)
	}

	for _, raw := range lines {
		line := strings.TrimRight(raw, " \t\r")

		if fenceRe.MatchString(line) {
			inFence = !inFence
			if cur := current(stack); cur != nil {
				cur.body = append(cur.body, line)
			}
			continue
		}
		if inFence {
			if cur := current(stack); cur != nil {
				cur.body = append(cur.body, line)
			}
			continue
		}

		if strings.TrimSpace(line) == "" {
			if cur := current(stack); cur != nil && len(cur.body) > 0 {
				cur.body = append(cur.body, "")
			}
			continue
		}

		if m := metaRe.FindStringSubmatch(strings.TrimSpace(line)); m != nil {
			if cur := current(stack); cur != nil {
				var meta Meta
				if err := json.Unmarshal([]byte(m[1]), &meta); err == nil {
					meta.applyTo(cur.topic)
				}
			}
			continue
		}

		if m := headingRe.FindStringSubmatch(line); m != nil {
			level := len(m[1])
			headingBase = level
			n := newParsedNode(level, strings.TrimSpace(m[2]), false)
			n.topic.MdForm = FormHeading
			attach(n)
			continue
		}

		if m := listItemRe.FindStringSubmatch(line); m != nil {
			indent := indentWidth(m[1])
			level := headingBase + 1 + indent/2
			title, body := splitListItem(strings.TrimSpace(m[2]))
			n := newParsedNode(level, title, true)
			n.topic.MdForm = FormList
			if body != "" {
				n.body = append(n.body, body)
			}
			attach(n)
			continue
		}

		if strings.HasPrefix(strings.TrimSpace(line), ">") {
			if cur := current(stack); cur != nil {
				cur.notes = append(cur.notes, strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), ">")))
			}
			continue
		}

		// Обычный абзац — тело текущего узла.
		if cur := current(stack); cur != nil {
			if cur.inList {
				// Продолжение пункта списка (висячий отступ) — тоже тело пункта.
				cur.body = append(cur.body, strings.TrimSpace(line))
			} else {
				cur.body = append(cur.body, line)
			}
			continue
		}

		// Текст до первого заголовка — создаём для него узел верхнего уровня.
		n := newParsedNode(1, strings.TrimSpace(line), false)
		attach(n)
	}

	for _, n := range all {
		applyText(n)
	}

	switch len(roots) {
	case 0:
		return newTopic(orDefault(fallbackTitle, "Untitled"))
	case 1:
		return roots[0].topic
	default:
		root := newTopic(orDefault(fallbackTitle, "Untitled"))
		for _, r := range roots {
			root.Children = append(root.Children, r.topic)
		}
		return root
	}
}

// newParsedNode создаёт узел РОВНО с тем заголовком, что стоял в файле, включая
// пустой. Подстановка «Untitled» здесь была бы подменой данных: узел без имени —
// законное состояние карты (только что созданный узел), и после сохранения он
// должен вернуться таким же, а не переименованным.
func newParsedNode(level int, title string, inList bool) *parsedNode {
	return &parsedNode{
		level:  level,
		topic:  &model.Topic{ID: uuid.NewString(), Title: title},
		inList: inList,
	}
}

// newTopic — узел, которого в файле не было: корень-заглушка над несколькими
// корнями или над пустым файлом. Ему имя нужно, потому что показать его иначе
// нечем.
func newTopic(title string) *model.Topic {
	if strings.TrimSpace(title) == "" {
		title = "Untitled"
	}
	return &model.Topic{ID: uuid.NewString(), Title: title}
}

func current(stack []*parsedNode) *parsedNode {
	if len(stack) == 0 {
		return nil
	}
	return stack[len(stack)-1]
}

// applyText переносит накопленные строки узла в Body/Notes.
func applyText(n *parsedNode) {
	if n == nil {
		return
	}
	n.topic.Body = joinBlock(n.body)
	if len(n.notes) > 0 {
		n.topic.Notes = strings.TrimSpace(strings.Join(n.notes, "\n"))
	}
}

// splitListItem делит пункт списка на голову и тело: «Заголовок — текст»
// не трогаем, а вот многострочный пункт `Заголовок<br>тело` разбираем.
func splitListItem(s string) (title, body string) {
	if i := strings.Index(s, "<br>"); i >= 0 {
		return strings.TrimSpace(s[:i]), strings.TrimSpace(strings.ReplaceAll(s[i+4:], "<br>", "\n"))
	}
	return s, ""
}

func joinBlock(lines []string) string {
	out := make([]string, len(lines))
	for i, l := range lines {
		out[i] = unescapeBodyLine(l)
	}
	return strings.TrimSpace(strings.Join(out, "\n"))
}

// escapeBodyLine экранирует строку тела, которая иначе была бы прочитана как
// заголовок, пункт списка или цитата — иначе тело узла при повторном открытии
// файла превратилось бы в отдельные узлы.
// looksLikeMarkup — прочитает ли разбор эту строку как разметку, а не как текст.
//
// ⚠️ Хвостовые пробелы и \r снимаются здесь намеренно, и это исправление, а не
// перестраховка. Разбор начинает с `strings.TrimRight(raw, " \t\r")`, а
// экранирование проверяло строку как есть — на строке «+\r» стороны расходились:
// рендер маркера не видел и не экранировал, а разбор после обрезки видел «+» и
// заводил лишний узел. Одна общая проверка на обе стороны закрывает целый класс
// таких расхождений: сравнивается ровно то, что увидит разбор.
func looksLikeMarkup(s string) bool {
	s = strings.TrimRight(s, " \t\r")
	return headingRe.MatchString(s) || listItemRe.MatchString(s) || strings.HasPrefix(s, ">")
}

func escapeBodyLine(l string) string {
	t := strings.TrimLeft(l, " \t")
	if looksLikeMarkup(t) {
		i := len(l) - len(t)
		return l[:i] + `\` + t
	}
	return l
}

func unescapeBodyLine(l string) string {
	t := strings.TrimLeft(l, " \t")
	if !strings.HasPrefix(t, `\`) {
		return l
	}
	rest := t[1:]
	if looksLikeMarkup(rest) {
		i := len(l) - len(t)
		return l[:i] + rest
	}
	return l
}

func splitLines(s string) []string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.Split(s, "\n")
}

// stripFrontMatter убирает YAML-преамбулу `--- ... ---` в начале файла.
func stripFrontMatter(lines []string) []string {
	i := 0
	for i < len(lines) && strings.TrimSpace(lines[i]) == "" {
		i++
	}
	if i >= len(lines) || !frontDelimR.MatchString(lines[i]) {
		return lines
	}
	for j := i + 1; j < len(lines); j++ {
		if frontDelimR.MatchString(lines[j]) {
			return lines[j+1:]
		}
	}
	return lines
}

func indentWidth(s string) int {
	w := 0
	for _, r := range s {
		if r == '\t' {
			w += 2
		} else {
			w++
		}
	}
	return w
}

func orDefault(s, def string) string {
	if strings.TrimSpace(s) == "" {
		return def
	}
	return s
}

// ─────────────────────────── Render ───────────────────────────

// Render собирает Markdown-документ из дерева топиков.
func Render(root *model.Topic) string {
	var sb strings.Builder
	renderTopic(&sb, root, 1)
	return collapseBlankLines(strings.TrimLeft(sb.String(), "\n"))
}

func renderTopic(sb *strings.Builder, t *model.Topic, level int) {
	if t == nil {
		return
	}
	// Корень всегда заголовок: файл, начинающийся с «- пункт», читался бы как
	// список без названия. Ниже форма узла решает, заголовок это или пункт.
	if level <= MaxHeadingLevel && (level == 1 || t.MdForm != FormList) {
		// Пустой заголовок пишется одними решётками, без висячего пробела: строка
		// «## » всё равно потеряет его при разборе (хвостовые пробелы обрезаются),
		// и лучше сразу писать то, что будет прочитано.
		fmt.Fprintf(sb, "\n%s\n\n", strings.TrimRight(strings.Repeat("#", level)+" "+oneLine(t.Title), " "))
		writeAttachments(sb, t, "")
		for _, c := range t.Children {
			renderTopic(sb, c, level+1)
		}
		return
	}
	// Внутри списка заголовков быть не может — вся ветка идёт пунктами.
	renderListItem(sb, t, 0)
}

func renderListItem(sb *strings.Builder, t *model.Topic, depth int) {
	pad := strings.Repeat("  ", depth)
	title := oneLine(t.Title)
	if body := oneLine(t.Body); body != "" {
		title += "<br>" + body
	}
	// Как и у заголовка: пункт без текста пишется одним маркером.
	fmt.Fprintf(sb, "%s\n", strings.TrimRight(pad+"- "+title, " "))
	writeAttachments(sb, t, pad+"  ")
	for _, c := range t.Children {
		renderListItem(sb, c, depth+1)
	}
}

// writeAttachments печатает тело, заметку и meta-комментарий узла.
func writeAttachments(sb *strings.Builder, t *model.Topic, pad string) {
	inList := pad != ""
	if !inList && strings.TrimSpace(t.Body) != "" {
		body := strings.Split(strings.TrimSpace(t.Body), "\n")
		for i, l := range body {
			body[i] = escapeBodyLine(l)
		}
		fmt.Fprintf(sb, "%s\n\n", strings.Join(body, "\n"))
	}
	if strings.TrimSpace(t.Notes) != "" {
		for _, l := range strings.Split(strings.TrimSpace(t.Notes), "\n") {
			fmt.Fprintf(sb, "%s> %s\n", pad, l)
		}
		sb.WriteString("\n")
	}
	if m := metaOf(t); !m.isEmpty() {
		if b, err := json.Marshal(m); err == nil {
			fmt.Fprintf(sb, "%s<!-- gmind: %s -->\n\n", pad, string(b))
		}
	}
}

// collapseBlankLines схлопывает подряд идущие пустые строки до одной:
// блоки склеиваются из независимых кусков, и без этого файл «разъезжается».
func collapseBlankLines(s string) string {
	lines := strings.Split(s, "\n")
	out := make([]string, 0, len(lines))
	blank := 0
	for _, l := range lines {
		if strings.TrimSpace(l) == "" {
			blank++
			if blank > 1 {
				continue
			}
		} else {
			blank = 0
		}
		out = append(out, l)
	}
	return strings.TrimRight(strings.Join(out, "\n"), "\n") + "\n"
}

// oneLine сворачивает переводы строк — заголовок и пункт списка однострочны.
func oneLine(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\r\n", "\n")
	return strings.ReplaceAll(s, "\n", "<br>")
}
