// Инструмент замера: что теряет карта, пройдя цикл Render → Parse через Markdown.
//
// Не фича и не часть сервера — измерительный прибор для слоя лабы, поэтому
// живёт в tools/ рядом с генераторами. Вход — JSON-массив книг (model.Workbook)
// на stdin, выход — один JSON-отчёт на stdout, диагностика в stderr.
//
// Почему отдельная программа, а не тест: тест отвечает «да/нет» на заранее
// известное ожидание, а замеру нужна ВЕЛИЧИНА потери по каждому полю, снятая с
// настоящих книг пользователя. Ожидания у замера нет — он его и добывает.
//
// ⚠️ Поля перечисляются рефлексией по model.Topic, а не руками. Список руками
// устарел бы молча: новое поле модели не попало бы в замер, и отчёт продолжал
// бы показывать полную сохранность, ничего не зная о потерянном.
//
// Запуск: go run ./tools/md-roundtrip < books.json
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"reflect"
	"strings"

	"github.com/gmind/backend/internal/markdown"
	"github.com/gmind/backend/internal/model"
)

// fieldStat — судьба одного поля модели на одном корпусе книг.
type fieldStat struct {
	// Before — у скольких узлов поле было заполнено до цикла.
	Before int `json:"before"`
	// After — у скольких заполнено после.
	After int `json:"after"`
	// Kept — у скольких узлов значение дошло без изменения. Считается только по
	// узлам, которые вообще удалось сопоставить: у несопоставленного узла поле
	// не «потеряно», о нём просто нечего сказать.
	Kept int `json:"kept"`
}

type bookReport struct {
	Title string `json:"title"`
	// NodesBefore/NodesAfter — расходятся, если сам скелет дерева не пережил цикл.
	NodesBefore int `json:"nodes_before"`
	NodesAfter  int `json:"nodes_after"`
	// Matched — узлов, сопоставленных по порядку обхода.
	Matched int `json:"matched"`
	// IDsKept — у скольких сопоставленных узлов совпал идентификатор. Это и есть
	// вопрос об адресуемости: адрес, меняющийся при сохранении, адресом не является.
	IDsKept int `json:"ids_kept"`
	// RelsBefore — связей во входных книгах. В выход они не попадают по сигнатуре:
	// Render принимает корневой Topic, а связи живут на уровне Sheet.
	RelsBefore int `json:"rels_before"`
	// MdBytes/JSONBytes — во что превращается книга на диске тем и другим носителем.
	MdBytes   int `json:"md_bytes"`
	JSONBytes int `json:"json_bytes"`

	Fields map[string]fieldStat `json:"fields"`

	// Examples — по нескольку конкретных расхождений на поле. Отчёт в долях
	// говорит, СКОЛЬКО потеряно, но не что именно; без примеров причину потери
	// приходится угадывать по коду, а угаданная причина лечится наугад.
	Examples []example `json:"examples,omitempty"`
}

type example struct {
	Field  string `json:"field"`
	Before string `json:"before"`
	After  string `json:"after"`
	// Diff — окно вокруг первого различающегося байта. Без него расхождение в
	// невидимом символе (возврат каретки, ведущий пробел, экранирующая косая)
	// выглядит в отчёте как два одинаковых значения, и причину искать не по чему.
	Diff string `json:"diff,omitempty"`
}

// diffWindow показывает, где строки разошлись впервые, с экранированием
// невидимых символов.
func diffWindow(a, b string) string {
	i := 0
	for i < len(a) && i < len(b) && a[i] == b[i] {
		i++
	}
	if i == len(a) && i == len(b) {
		return ""
	}
	from := i - 20
	if from < 0 {
		from = 0
	}
	cut := func(s string) string {
		to := i + 20
		if to > len(s) {
			to = len(s)
		}
		if from > len(s) {
			return "«конец строки»"
		}
		return fmt.Sprintf("%q", s[from:to])
	}
	return fmt.Sprintf("байт %d: было %s · стало %s", i, cut(a), cut(b))
}

// short обрезает значение до читаемой длины: в примере важен вид расхождения,
// а не всё содержимое узла.
func short(v any) string {
	s := fmt.Sprintf("%v", v)
	s = strings.ReplaceAll(s, "\n", "\\n")
	if len(s) > 90 {
		return s[:90] + "…"
	}
	return s
}

// flatten — обход дерева в том же порядке, в каком его пишет Render: узел,
// затем потомки слева направо. Сопоставление до/после идёт по этому порядку,
// потому что идентификаторы цикл не переживают — а именно это и проверяется.
func flatten(t *model.Topic, out *[]*model.Topic) {
	if t == nil {
		return
	}
	*out = append(*out, t)
	for _, c := range t.Children {
		flatten(c, out)
	}
}

// topicFields — имена полей model.Topic, кроме Children: дети не свойство узла,
// а само дерево, и его сохранность меряется счётчиком узлов.
func topicFields() []string {
	var names []string
	rt := reflect.TypeOf(model.Topic{})
	for i := 0; i < rt.NumField(); i++ {
		if rt.Field(i).Name == "Children" {
			continue
		}
		names = append(names, rt.Field(i).Name)
	}
	return names
}

func filled(v reflect.Value) bool {
	return !v.IsZero()
}

func main() {
	// maxExamples — сколько расхождений показывать на поле. Ноль по умолчанию:
	// замер читает только числа, а примеры нужны, когда причину лечат.
	maxExamples := flag.Int("examples", 0, "сколько примеров расхождения печатать на поле")
	flag.Parse()

	var books []model.Workbook
	if err := json.NewDecoder(os.Stdin).Decode(&books); err != nil {
		fmt.Fprintf(os.Stderr, "md-roundtrip: не читается вход: %v\n", err)
		os.Exit(1)
	}

	names := topicFields()
	reports := make([]bookReport, 0, len(books))

	for _, wb := range books {
		rep := bookReport{Title: wb.Title, Fields: map[string]fieldStat{}}
		for _, name := range names {
			rep.Fields[name] = fieldStat{}
		}

		for _, sheet := range wb.Sheets {
			if sheet == nil || sheet.RootTopic == nil {
				continue
			}
			rep.RelsBefore += len(sheet.Relationships)

			var before []*model.Topic
			flatten(sheet.RootTopic, &before)

			md := markdown.Render(sheet.RootTopic)
			// ⚠️ fallbackTitle пустой намеренно: если заголовок не пережил рендер,
			// подстановка исходного названия скрыла бы ровно эту потерю.
			parsed := markdown.Parse(md, "")
			var after []*model.Topic
			flatten(parsed, &after)

			raw, _ := json.Marshal(sheet.RootTopic)
			rep.MdBytes += len(md)
			rep.JSONBytes += len(raw)
			rep.NodesBefore += len(before)
			rep.NodesAfter += len(after)

			n := len(before)
			if len(after) < n {
				n = len(after)
			}
			rep.Matched += n

			for _, name := range names {
				stat := rep.Fields[name]
				for _, t := range before {
					if filled(reflect.ValueOf(*t).FieldByName(name)) {
						stat.Before++
					}
				}
				for _, t := range after {
					if filled(reflect.ValueOf(*t).FieldByName(name)) {
						stat.After++
					}
				}
				shown := 0
				for i := 0; i < n; i++ {
					a := reflect.ValueOf(*before[i]).FieldByName(name)
					b := reflect.ValueOf(*after[i]).FieldByName(name)
					// Пустое поле, оставшееся пустым, — не сохранность: сохранять
					// было нечего. В Kept идут только дошедшие значения.
					if filled(a) && reflect.DeepEqual(a.Interface(), b.Interface()) {
						stat.Kept++
						continue
					}
					if filled(a) && shown < *maxExamples {
						shown++
						ex := example{Field: name, Before: short(a.Interface()), After: short(b.Interface())}
						if a.Kind() == reflect.String {
							ex.Diff = diffWindow(a.String(), b.String())
						}
						rep.Examples = append(rep.Examples, ex)
					}
				}
				rep.Fields[name] = stat
			}

			for i := 0; i < n; i++ {
				if before[i].ID != "" && before[i].ID == after[i].ID {
					rep.IDsKept++
				}
			}
		}
		reports = append(reports, rep)
	}

	if err := json.NewEncoder(os.Stdout).Encode(reports); err != nil {
		fmt.Fprintf(os.Stderr, "md-roundtrip: не пишется отчёт: %v\n", err)
		os.Exit(1)
	}
}
