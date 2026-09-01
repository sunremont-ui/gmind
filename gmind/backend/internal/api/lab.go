package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

// Слой лабы в Gmind: реестр проектов, у которых есть трек, и чтение того, чем
// трек живёт — записей из MASys и отчётов замеров с диска.
//
// Реестр хранит ТОЛЬКО пути. Трек, namespace, оракул и путь экспорта читаются из
// lab.config.json самого проекта: продублировать их в настройках Gmind значило бы
// завести вторую правду, которая разойдётся с первой молча — ровно тот класс
// ошибки, от которого защищает сама лаба.
//
// Второе назначение реестра — allowlist. Запросы приносят путь, а сервер ходит
// только по зарегистрированным каталогам: иначе `GET /lab/run?path=...` читал бы
// произвольный файл с диска пользователя.

// labProjectConfig — lab.config.json проекта. Поля, которых Gmind не показывает
// (version), намеренно не читаются: разбор молча стерпит их отсутствие.
type labProjectConfig struct {
	Track      string `json:"track"`
	Namespace  string `json:"namespace"`
	ServerURL  string `json:"serverUrl"`
	ExportPath string `json:"exportPath"`
	Oracle     struct {
		Command string   `json:"command"`
		Args    []string `json:"args"`
	} `json:"oracle"`
}

// labRegistryEntry — строка реестра. `Label` необязателен: пусто — берём имя
// каталога.
type labRegistryEntry struct {
	Path  string `json:"path"`
	Label string `json:"label,omitempty"`
}

type labRegistryFile struct {
	Projects []labRegistryEntry `json:"projects"`
}

// labProject — то, что уходит на фронт: строка реестра, конфиг лабы и следы
// замеров. Поле `Error` не делает ответ ошибочным: каталог мог исчезнуть или
// потерять lab.config.json, и это надо ПОКАЗАТЬ, а не уронить весь список.
type labProject struct {
	Path       string   `json:"path"`
	Label      string   `json:"label"`
	Track      string   `json:"track"`
	Namespace  string   `json:"namespace"`
	ExportPath string   `json:"export_path,omitempty"`
	Oracle     string   `json:"oracle,omitempty"`
	Labs       []string `json:"labs"`
	Reports    []string `json:"reports"`
	Error      string   `json:"error,omitempty"`
}

// labRunSummary — шапка замера: то, что видно в списке, без строк матрицы.
type labRunSummary struct {
	Lab        string            `json:"lab"`
	Question   string            `json:"question,omitempty"`
	Track      string            `json:"track,omitempty"`
	StartedAt  string            `json:"started_at,omitempty"`
	FinishedAt string            `json:"finished_at,omitempty"`
	Paid       bool              `json:"paid"`
	EstimateRu float64           `json:"estimate_rub"`
	Gate       bool              `json:"gate"`
	GateFailed bool              `json:"gate_failed"`
	Summaries  []json.RawMessage `json:"summaries,omitempty"`
	HasReport  bool              `json:"has_report"`
	HasScript  bool              `json:"has_script"`
	Error      string            `json:"error,omitempty"`
}

// labRegistry — реестр в файле рядом с остальными настройками Gmind.
type labRegistry struct {
	mu   sync.RWMutex
	path string
}

func newLabRegistry(path string) *labRegistry { return &labRegistry{path: path} }

func (lr *labRegistry) load() []labRegistryEntry {
	lr.mu.RLock()
	defer lr.mu.RUnlock()
	if lr.path == "" {
		return nil
	}
	data, err := os.ReadFile(lr.path)
	if err != nil {
		return nil
	}
	var file labRegistryFile
	if err := json.Unmarshal(data, &file); err != nil {
		return nil
	}
	return file.Projects
}

func (lr *labRegistry) save(entries []labRegistryEntry) error {
	lr.mu.Lock()
	defer lr.mu.Unlock()
	if lr.path == "" {
		return fmt.Errorf("lab registry path is not configured")
	}
	if err := os.MkdirAll(filepath.Dir(lr.path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(labRegistryFile{Projects: entries}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(lr.path, data, 0o644)
}

// normalizeLabPath приводит путь к одному виду, чтобы «D:\Gmind» и «D:/Gmind/»
// не стали двумя разными проектами в реестре.
func normalizeLabPath(p string) string {
	p = strings.TrimSpace(p)
	if p == "" {
		return ""
	}
	p = filepath.Clean(filepath.FromSlash(p))
	return strings.TrimSuffix(p, string(filepath.Separator))
}

func (lr *labRegistry) add(entry labRegistryEntry) ([]labRegistryEntry, error) {
	entry.Path = normalizeLabPath(entry.Path)
	if entry.Path == "" {
		return nil, fmt.Errorf("path is required")
	}
	entries := lr.load()
	for i, e := range entries {
		if strings.EqualFold(normalizeLabPath(e.Path), entry.Path) {
			entries[i] = entry // повторное добавление обновляет подпись, а не двоит строку
			return entries, lr.save(entries)
		}
	}
	entries = append(entries, entry)
	return entries, lr.save(entries)
}

func (lr *labRegistry) remove(path string) ([]labRegistryEntry, error) {
	path = normalizeLabPath(path)
	entries := lr.load()
	kept := make([]labRegistryEntry, 0, len(entries))
	for _, e := range entries {
		if strings.EqualFold(normalizeLabPath(e.Path), path) {
			continue
		}
		kept = append(kept, e)
	}
	return kept, lr.save(kept)
}

// allows отвечает, зарегистрирован ли каталог. Сравнение по нормализованному
// пути и без учёта регистра: на Windows «d:\gmind» и «D:\Gmind» — один каталог.
func (lr *labRegistry) allows(path string) bool {
	path = normalizeLabPath(path)
	if path == "" {
		return false
	}
	for _, e := range lr.load() {
		if strings.EqualFold(normalizeLabPath(e.Path), path) {
			return true
		}
	}
	return false
}

// readLabConfig читает lab.config.json проекта.
func readLabConfig(dir string) (labProjectConfig, error) {
	var cfg labProjectConfig
	data, err := os.ReadFile(filepath.Join(dir, "lab.config.json"))
	if err != nil {
		return cfg, err
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("lab.config.json: %w", err)
	}
	if cfg.Track == "" {
		return cfg, fmt.Errorf("lab.config.json: track is empty")
	}
	if cfg.Namespace == "" {
		cfg.Namespace = "default"
	}
	return cfg, nil
}

// labScriptNames — имена замеров из labs/*.lab.mjs.
func labScriptNames(dir string) []string {
	matches, err := filepath.Glob(filepath.Join(dir, "labs", "*.lab.mjs"))
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(matches))
	for _, m := range matches {
		names = append(names, strings.TrimSuffix(filepath.Base(m), ".lab.mjs"))
	}
	sort.Strings(names)
	return names
}

// labReportNames — имена замеров, у которых есть отчёт в lab-out/<имя>/report.json.
//
// Каталог без report.json пропускается намеренно: он означает начатый и не
// доведённый прогон, а не замер, который можно показать.
func labReportNames(dir string) []string {
	entries, err := os.ReadDir(filepath.Join(dir, "lab-out"))
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		if _, err := os.Stat(filepath.Join(dir, "lab-out", e.Name(), "report.json")); err != nil {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)
	return names
}

// labProjectInfo собирает строку списка. Ошибка чтения конфига возвращается в
// поле, а не наверх: список из пяти проектов не должен пропадать целиком из-за
// одного отключённого диска.
func labProjectInfo(entry labRegistryEntry) labProject {
	dir := normalizeLabPath(entry.Path)
	p := labProject{Path: dir, Label: entry.Label, Labs: []string{}, Reports: []string{}}
	if p.Label == "" {
		p.Label = filepath.Base(dir)
	}
	cfg, err := readLabConfig(dir)
	if err != nil {
		p.Error = err.Error()
		return p
	}
	p.Track = cfg.Track
	p.Namespace = cfg.Namespace
	p.ExportPath = cfg.ExportPath
	if cfg.Oracle.Command != "" {
		p.Oracle = strings.TrimSpace(cfg.Oracle.Command + " " + strings.Join(cfg.Oracle.Args, " "))
	}
	if names := labScriptNames(dir); names != nil {
		p.Labs = names
	}
	if names := labReportNames(dir); names != nil {
		p.Reports = names
	}
	return p
}

// ListLabProjects — GET /api/v1/lab/projects.
func (h *Handler) ListLabProjects(w http.ResponseWriter, r *http.Request) {
	if h.labRegistry == nil {
		writeJSON(w, http.StatusOK, map[string]any{"projects": []labProject{}})
		return
	}
	entries := h.labRegistry.load()
	projects := make([]labProject, 0, len(entries))
	for _, e := range entries {
		projects = append(projects, labProjectInfo(e))
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

type labProjectRequest struct {
	Path  string `json:"path"`
	Label string `json:"label"`
}

// AddLabProject — POST /api/v1/lab/projects.
//
// Каталог без lab.config.json не регистрируется: реестр лабы, в котором лежит
// проект без трека, был бы списком, по которому нечего показать.
func (h *Handler) AddLabProject(w http.ResponseWriter, r *http.Request) {
	if h.labRegistry == nil {
		writeError(w, http.StatusServiceUnavailable, "lab registry is not configured")
		return
	}
	var req labProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	dir := normalizeLabPath(req.Path)
	if dir == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}
	if _, err := readLabConfig(dir); err != nil {
		writeError(w, http.StatusBadRequest, "в каталоге нет читаемого lab.config.json: "+err.Error())
		return
	}
	entries, err := h.labRegistry.add(labRegistryEntry{Path: dir, Label: strings.TrimSpace(req.Label)})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	projects := make([]labProject, 0, len(entries))
	for _, e := range entries {
		projects = append(projects, labProjectInfo(e))
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

// RemoveLabProject — DELETE /api/v1/lab/projects?path=...
func (h *Handler) RemoveLabProject(w http.ResponseWriter, r *http.Request) {
	if h.labRegistry == nil {
		writeError(w, http.StatusServiceUnavailable, "lab registry is not configured")
		return
	}
	path := r.URL.Query().Get("path")
	if strings.TrimSpace(path) == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}
	entries, err := h.labRegistry.remove(path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	projects := make([]labProject, 0, len(entries))
	for _, e := range entries {
		projects = append(projects, labProjectInfo(e))
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

// LabTrackState — GET /api/v1/lab/track?track=GM&namespace=gmind[&entries=1]
//
// Состояние трека и, по запросу, все его записи. Два вызова MASys склеиваются
// здесь, а не на фронте: вид трека без записей пуст, а два круга по сети ради
// одного экрана — лишняя задержка на медленном контуре.
func (h *Handler) LabTrackState(w http.ResponseWriter, r *http.Request) {
	track := strings.TrimSpace(r.URL.Query().Get("track"))
	if track == "" {
		writeError(w, http.StatusBadRequest, "track is required")
		return
	}
	namespace := strings.TrimSpace(r.URL.Query().Get("namespace"))
	if namespace == "" {
		namespace = "default"
	}

	state, err := h.callTRPCQuery(r.Context(), "memory.lab.state", map[string]any{
		"track": track, "namespace": namespace,
	})
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	out := map[string]any{"state": json.RawMessage(state)}

	if r.URL.Query().Get("entries") != "" {
		entries, err := h.callTRPCQuery(r.Context(), "memory.lab.list", map[string]any{
			"track": track, "namespace": namespace, "limit": 1000,
		})
		if err != nil {
			writeError(w, http.StatusBadGateway, err.Error())
			return
		}
		out["entries"] = json.RawMessage(entries)
	}
	writeJSON(w, http.StatusOK, out)
}

// readLabReport читает и разбирает отчёт замера.
func readLabReport(dir, lab string) (map[string]json.RawMessage, error) {
	data, err := os.ReadFile(filepath.Join(dir, "lab-out", lab, "report.json"))
	if err != nil {
		return nil, err
	}
	var report map[string]json.RawMessage
	if err := json.Unmarshal(data, &report); err != nil {
		return nil, fmt.Errorf("report.json: %w", err)
	}
	return report, nil
}

// labRunHead достаёт из отчёта шапку, не таща строки матрицы.
func labRunHead(dir, lab string) labRunSummary {
	head := labRunSummary{Lab: lab}
	report, err := readLabReport(dir, lab)
	if err != nil {
		head.Error = err.Error()
		return head
	}
	head.HasReport = true
	str := func(key string) string {
		raw, ok := report[key]
		if !ok {
			return ""
		}
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return ""
		}
		return s
	}
	boolean := func(key string) bool {
		raw, ok := report[key]
		if !ok {
			return false
		}
		var b bool
		return json.Unmarshal(raw, &b) == nil && b
	}
	head.Question = str("question")
	head.Track = str("track")
	head.StartedAt = str("startedAt")
	head.FinishedAt = str("finishedAt")
	head.Paid = boolean("paid")
	head.Gate = boolean("gate")
	head.GateFailed = boolean("gateFailed")
	if raw, ok := report["estimateRub"]; ok {
		_ = json.Unmarshal(raw, &head.EstimateRu)
	}
	if raw, ok := report["summaries"]; ok {
		_ = json.Unmarshal(raw, &head.Summaries)
	}
	return head
}

// requireLabDir проверяет, что каталог зарегистрирован. Незарегистрированный
// путь отвергается до любого чтения с диска.
func (h *Handler) requireLabDir(w http.ResponseWriter, r *http.Request) (string, bool) {
	dir := normalizeLabPath(r.URL.Query().Get("path"))
	if dir == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return "", false
	}
	if h.labRegistry == nil || !h.labRegistry.allows(dir) {
		writeError(w, http.StatusForbidden, "каталог не в реестре лабы: "+dir)
		return "", false
	}
	return dir, true
}

// ListLabRuns — GET /api/v1/lab/runs?path=...
//
// Замер без отчёта тоже попадает в список: файл labs/<имя>.lab.mjs есть, а
// прогона не было — это состояние стоит видеть, а не скрывать.
func (h *Handler) ListLabRuns(w http.ResponseWriter, r *http.Request) {
	dir, ok := h.requireLabDir(w, r)
	if !ok {
		return
	}
	scripts := labScriptNames(dir)
	reports := labReportNames(dir)

	seen := make(map[string]bool, len(scripts)+len(reports))
	names := make([]string, 0, len(scripts)+len(reports))
	for _, n := range append(append([]string{}, scripts...), reports...) {
		if seen[n] {
			continue
		}
		seen[n] = true
		names = append(names, n)
	}
	sort.Strings(names)

	hasScript := make(map[string]bool, len(scripts))
	for _, n := range scripts {
		hasScript[n] = true
	}
	hasReport := make(map[string]bool, len(reports))
	for _, n := range reports {
		hasReport[n] = true
	}

	runs := make([]labRunSummary, 0, len(names))
	for _, n := range names {
		var head labRunSummary
		if hasReport[n] {
			head = labRunHead(dir, n)
		} else {
			head = labRunSummary{Lab: n}
		}
		head.HasScript = hasScript[n]
		runs = append(runs, head)
	}
	writeJSON(w, http.StatusOK, map[string]any{"runs": runs})
}

// GetLabRun — GET /api/v1/lab/run?path=...&lab=...
func (h *Handler) GetLabRun(w http.ResponseWriter, r *http.Request) {
	dir, ok := h.requireLabDir(w, r)
	if !ok {
		return
	}
	lab := strings.TrimSpace(r.URL.Query().Get("lab"))
	// Имя замера идёт в путь: обход каталогов отсекается здесь, а не надеждой
	// на то, что fs.Glob чего-то не пропустит.
	if lab == "" || strings.ContainsAny(lab, `/\`) || strings.Contains(lab, "..") {
		writeError(w, http.StatusBadRequest, "lab is required and must be a plain name")
		return
	}
	report, err := readLabReport(dir, lab)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, report)
}

// ─── Память проекта ──────────────────────────────────────────────────────────

// labMemoryLayer — слой памяти MASys в namespace проекта.
//
// `Capped` обязателен: выборка каждого слоя ограничена потолком, и число,
// упершееся в него, — нижняя граница, а не размер слоя. Показать «200» как
// точное количество значило бы соврать ровно там, где экран обещает факт.
type labMemoryLayer struct {
	Key    string `json:"key"`
	Label  string `json:"label"`
	Count  int    `json:"count"`
	Capped bool   `json:"capped"`
	Error  string `json:"error,omitempty"`
}

// labMemorySpec — что и как считать в одном слое.
type labMemorySpec struct {
	key    string
	label  string
	method string
	limit  int // 0 — у процедуры нет потолка выборки
}

// Потолки взяты из схем MASys и запрошены явно. У `result.list` и
// `controller.decisions` есть УМОЛЧАНИЯ выборки (50 и 100): не попросив предел,
// счётчик получал ровно их и выдавал за точное число слоя.
var labMemorySpecs = []labMemorySpec{
	{"episodes", "Эпизоды", "memory.episode.recent", 200},
	{"entities", "Сущности", "memory.entity.list", 500},
	{"skills", "Навыки", "memory.skill.list", 0},
	{"wiki", "Wiki", "memory.wiki.list", 0},
	{"results", "Артефакты", "memory.result.list", 500},
	{"decisions", "Решения", "memory.controller.decisions", 500},
	{"conversations", "Диалоги", "memory.conversation.list", 0},
}

// countTRPCList считает длину списка в ответе.
//
// Форма ответа у слоёв разная: одни отдают массив, другие — объект с массивом
// внутри (`{skills: [...], counts: {...}}`). Разбор терпит обе, потому что
// перечислять ключи по одному пришлось бы править при каждом новом слое.
func countTRPCList(raw json.RawMessage) (int, bool) {
	var asArray []json.RawMessage
	if json.Unmarshal(raw, &asArray) == nil {
		return len(asArray), true
	}
	var asObject map[string]json.RawMessage
	if json.Unmarshal(raw, &asObject) != nil {
		return 0, false
	}
	for _, v := range asObject {
		var list []json.RawMessage
		if json.Unmarshal(v, &list) == nil {
			return len(list), true
		}
	}
	return 0, false
}

// LabProjectMemory — GET /api/v1/lab/memory?namespace=...
//
// Семь слоёв опрашиваются разом, а не по очереди: последовательно это семь
// круговых задержек ради одного экрана.
func (h *Handler) LabProjectMemory(w http.ResponseWriter, r *http.Request) {
	namespace := strings.TrimSpace(r.URL.Query().Get("namespace"))
	if namespace == "" {
		namespace = "default"
	}

	layers := make([]labMemoryLayer, len(labMemorySpecs))
	var wg sync.WaitGroup
	for i, spec := range labMemorySpecs {
		wg.Add(1)
		go func(i int, spec labMemorySpec) {
			defer wg.Done()
			layer := labMemoryLayer{Key: spec.key, Label: spec.label}
			input := map[string]any{"namespace": namespace}
			if spec.limit > 0 {
				input["limit"] = spec.limit
			}
			raw, err := h.callTRPCQuery(r.Context(), spec.method, input)
			if err != nil {
				layer.Error = err.Error()
				layers[i] = layer
				return
			}
			count, ok := countTRPCList(raw)
			if !ok {
				layer.Error = "ответ слоя не список"
				layers[i] = layer
				return
			}
			layer.Count = count
			layer.Capped = spec.limit > 0 && count >= spec.limit
			layers[i] = layer
		}(i, spec)
	}
	wg.Wait()

	writeJSON(w, http.StatusOK, map[string]any{"namespace": namespace, "layers": layers})
}
