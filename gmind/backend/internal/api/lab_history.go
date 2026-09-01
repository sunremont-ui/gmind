package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// История прогонов.
//
// `lab-out/<замер>/report.json` хранит ТОЛЬКО последний отчёт: каждый прогон
// затирает предыдущий. Сравнить две даты по нему невозможно — не потому, что
// каркас плох, а потому, что он и не обещал истории.
//
// Архив ведёт Gmind у себя, в своём каталоге данных, и НЕ пишет в каталоги
// чужих проектов. Основание то же, по которому MASys не пишет в `lab/**`
// проекта: инструмент, незаметно раскладывающий файлы в чужом дереве, однажды
// сделает это в момент, когда там идёт своя работа. Плата за решение — архив
// живёт на машине, а не в репозитории проекта, и переезд машины его не
// переживает.

// labHistoryEntry — шапка архивного отчёта.
type labHistoryEntry struct {
	At         string  `json:"at"`
	StartedAt  string  `json:"started_at,omitempty"`
	FinishedAt string  `json:"finished_at,omitempty"`
	Gate       bool    `json:"gate"`
	GateFailed bool    `json:"gate_failed"`
	EstimateRu float64 `json:"estimate_rub"`
	Rows       int     `json:"rows"`
	Variants   int     `json:"variants"`
}

var labSlugUnsafe = regexp.MustCompile(`[^A-Za-z0-9]+`)

// labProjectSlug — имя каталога архива по пути проекта.
//
// Путь Windows содержит двоеточие и слэши, каталогом он быть не может. Слаг
// намеренно НЕ обратим: он лишь разводит проекты между собой, а какой это
// проект, известно из запроса.
func labProjectSlug(path string) string {
	slug := strings.Trim(labSlugUnsafe.ReplaceAllString(strings.ToLower(path), "-"), "-")
	if slug == "" {
		slug = "project"
	}
	if len(slug) > 60 {
		slug = slug[:60]
	}
	return slug
}

// labHistoryDir — каталог архива одного замера одного проекта.
func labHistoryDir(base, projectPath, lab string) string {
	return filepath.Join(base, labProjectSlug(projectPath), lab)
}

// labStampFromReport — метка версии отчёта: время начала прогона.
//
// Если его нет, отчёт архивируется под «unknown»: такой отчёт может быть только
// один, и это честнее, чем выдумать метку из времени копирования — та говорила
// бы, когда Gmind увидел файл, а не когда прогон был.
func labStampFromReport(report map[string]json.RawMessage) string {
	raw, ok := report["startedAt"]
	if !ok {
		return "unknown"
	}
	var started string
	if json.Unmarshal(raw, &started) != nil || strings.TrimSpace(started) == "" {
		return "unknown"
	}
	return labSlugUnsafe.ReplaceAllString(started, "-")
}

// archiveLabReport кладёт текущий отчёт в архив, если такой версии там ещё нет.
//
// Повторный вызов ничего не делает: версия определяется временем НАЧАЛА прогона,
// а не временем копирования, поэтому один и тот же отчёт не размножается от
// каждого открытия панели.
func archiveLabReport(base, projectDir, lab string) (string, error) {
	if base == "" {
		return "", fmt.Errorf("каталог архива не настроен")
	}
	report, err := readLabReport(projectDir, lab)
	if err != nil {
		return "", err
	}
	stamp := labStampFromReport(report)
	dir := labHistoryDir(base, projectDir, lab)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	target := filepath.Join(dir, stamp+".json")
	if _, err := os.Stat(target); err == nil {
		return target, nil // эта версия уже в архиве
	}
	data, err := json.Marshal(report)
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(target, data, 0o644); err != nil {
		return "", err
	}
	return target, nil
}

// labHistoryHead читает шапку архивного файла.
func labHistoryHead(path string) (labHistoryEntry, error) {
	entry := labHistoryEntry{At: strings.TrimSuffix(filepath.Base(path), ".json")}
	data, err := os.ReadFile(path)
	if err != nil {
		return entry, err
	}
	var report map[string]json.RawMessage
	if err := json.Unmarshal(data, &report); err != nil {
		return entry, err
	}
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
	entry.StartedAt = str("startedAt")
	entry.FinishedAt = str("finishedAt")
	entry.Gate = boolean("gate")
	entry.GateFailed = boolean("gateFailed")
	if raw, ok := report["estimateRub"]; ok {
		_ = json.Unmarshal(raw, &entry.EstimateRu)
	}
	if raw, ok := report["rows"]; ok {
		var rows []json.RawMessage
		if json.Unmarshal(raw, &rows) == nil {
			entry.Rows = len(rows)
		}
	}
	if raw, ok := report["summaries"]; ok {
		var sums []json.RawMessage
		if json.Unmarshal(raw, &sums) == nil {
			entry.Variants = len(sums)
		}
	}
	return entry, nil
}

// ListLabHistory — GET /api/v1/lab/history?path=...&lab=...
//
// Перед выдачей текущий отчёт с диска добавляется в архив: иначе прогон, сделанный
// в терминале, не попал бы в историю вовсе.
func (h *Handler) ListLabHistory(w http.ResponseWriter, r *http.Request) {
	dir, lab, ok := h.labDirAndLab(w, r)
	if !ok {
		return
	}
	if _, err := archiveLabReport(h.labHistoryPath, dir, lab); err != nil && !os.IsNotExist(err) {
		// Отсутствие отчёта — не ошибка запроса: архив может быть непуст, даже
		// когда lab-out очищен.
		_ = err
	}
	entries := listLabHistory(h.labHistoryPath, dir, lab)
	writeJSON(w, http.StatusOK, map[string]any{"history": entries})
}

func listLabHistory(base, projectDir, lab string) []labHistoryEntry {
	entries := []labHistoryEntry{}
	if base == "" {
		return entries
	}
	files, err := filepath.Glob(filepath.Join(labHistoryDir(base, projectDir, lab), "*.json"))
	if err != nil {
		return entries
	}
	for _, f := range files {
		head, err := labHistoryHead(f)
		if err != nil {
			continue
		}
		entries = append(entries, head)
	}
	// Свежие сверху: сравнивают обычно последний прогон с предыдущим.
	sort.Slice(entries, func(i, j int) bool { return entries[i].At > entries[j].At })
	return entries
}

// GetLabHistoryReport — GET /api/v1/lab/history/report?path=...&lab=...&at=...
func (h *Handler) GetLabHistoryReport(w http.ResponseWriter, r *http.Request) {
	dir, lab, ok := h.labDirAndLab(w, r)
	if !ok {
		return
	}
	at := strings.TrimSpace(r.URL.Query().Get("at"))
	if at == "" || strings.ContainsAny(at, `/\`) || strings.Contains(at, "..") {
		writeError(w, http.StatusBadRequest, "at is required and must be a plain stamp")
		return
	}
	if h.labHistoryPath == "" {
		writeError(w, http.StatusServiceUnavailable, "каталог архива не настроен")
		return
	}
	data, err := os.ReadFile(filepath.Join(labHistoryDir(h.labHistoryPath, dir, lab), at+".json"))
	if err != nil {
		writeError(w, http.StatusNotFound, "в архиве нет прогона "+at)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(data)
}

// labDirAndLab — общая проверка для истории: каталог из реестра и простое имя.
func (h *Handler) labDirAndLab(w http.ResponseWriter, r *http.Request) (string, string, bool) {
	dir, ok := h.requireLabDir(w, r)
	if !ok {
		return "", "", false
	}
	lab := strings.TrimSpace(r.URL.Query().Get("lab"))
	if lab == "" || strings.ContainsAny(lab, `/\`) || strings.Contains(lab, "..") {
		writeError(w, http.StatusBadRequest, "lab is required and must be a plain name")
		return "", "", false
	}
	return dir, lab, true
}
