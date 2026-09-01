package api

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

// Запуск замера из панели.
//
// Платные ячейки замер пропускает сам, пока ему не передали `--paid`; флаг здесь
// не передаётся и передан быть не может. Это не забывчивость: кнопка в панели не
// должна тратить деньги, а тот, кто согласен платить, делает это в терминале,
// где видит оценку до запуска.

// labRunProcess — один идущий (или уже завершившийся) прогон.
//
// Вывод копится в памяти целиком: замеры печатают десятки строк, а не поток
// логов, и держать их до конца сессии дешевле, чем городить файл, который
// потом некому удалить.
type labRunProcess struct {
	ID      string `json:"id"`
	Path    string `json:"path"`
	Lab     string `json:"lab"`
	Started string `json:"started_at"`

	mu       sync.Mutex
	lines    []string
	done     bool
	exitCode int
	failure  string
	cmd      *exec.Cmd
	// subs — подписчики SSE. Канал буферизован: медленный читатель не должен
	// останавливать процесс, чей вывод мы копируем.
	subs map[chan string]struct{}
}

func (p *labRunProcess) append(line string) {
	p.mu.Lock()
	p.lines = append(p.lines, line)
	for ch := range p.subs {
		select {
		case ch <- line:
		default: // подписчик не успевает — строка ему не достанется, прогон не ждёт
		}
	}
	p.mu.Unlock()
}

func (p *labRunProcess) finish(exitCode int, failure string) {
	p.mu.Lock()
	p.done = true
	p.exitCode = exitCode
	p.failure = failure
	for ch := range p.subs {
		close(ch)
	}
	p.subs = map[chan string]struct{}{}
	p.mu.Unlock()
}

// snapshot отдаёт накопленное и подписку на продолжение одним действием: между
// чтением буфера и подпиской иначе теряются строки.
func (p *labRunProcess) snapshot() ([]string, chan string, bool) {
	p.mu.Lock()
	defer p.mu.Unlock()
	lines := append([]string(nil), p.lines...)
	if p.done {
		return lines, nil, true
	}
	ch := make(chan string, 256)
	p.subs[ch] = struct{}{}
	return lines, ch, false
}

func (p *labRunProcess) unsubscribe(ch chan string) {
	p.mu.Lock()
	if _, ok := p.subs[ch]; ok {
		delete(p.subs, ch)
	}
	p.mu.Unlock()
}

func (p *labRunProcess) status() map[string]any {
	p.mu.Lock()
	defer p.mu.Unlock()
	return map[string]any{
		"id": p.ID, "path": p.Path, "lab": p.Lab, "started_at": p.Started,
		"done": p.done, "exit_code": p.exitCode, "failure": p.failure,
		"lines": len(p.lines),
	}
}

// labRunRegistry — идущие прогоны этой сессии.
type labRunRegistry struct {
	mu   sync.Mutex
	runs map[string]*labRunProcess
	seq  int
}

func newLabRunRegistry() *labRunRegistry {
	return &labRunRegistry{runs: map[string]*labRunProcess{}}
}

func (r *labRunRegistry) add(p *labRunProcess) {
	r.mu.Lock()
	r.seq++
	p.ID = fmt.Sprintf("labrun-%d-%d", time.Now().Unix(), r.seq)
	r.runs[p.ID] = p
	r.mu.Unlock()
}

func (r *labRunRegistry) get(id string) *labRunProcess {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.runs[id]
}

// labRunnerScript — чем проект запускает замеры.
//
// Обёртка у каждого проекта своя (в ней зашит машинно-локальный путь к MASys), и
// есть проекты, где её нет вовсе — MASys гоняет свои лабы через pnpm. Угадывать
// за них нечего: без обёртки кнопка не показывается, и панель говорит почему.
func labRunnerScript(dir string) (string, bool) {
	p := filepath.Join(dir, "lab-run.mjs")
	if _, err := os.Stat(p); err == nil {
		return "lab-run.mjs", true
	}
	return "", false
}

// labScriptFile ищет файл замера по имени: расширение у проектов разное.
func labScriptFile(dir, lab string) (string, bool) {
	matches, err := filepath.Glob(filepath.Join(dir, "labs", lab+".*"))
	if err != nil || len(matches) == 0 {
		return "", false
	}
	for _, m := range matches {
		name := filepath.Base(m)
		if strings.HasSuffix(name, ".mjs") || strings.HasSuffix(name, ".js") || strings.HasSuffix(name, ".ts") {
			return "labs/" + name, true
		}
	}
	return "", false
}

type labRunStartRequest struct {
	Path string `json:"path"`
	Lab  string `json:"lab"`
}

// StartLabRun — POST /api/v1/lab/runs/start
func (h *Handler) StartLabRun(w http.ResponseWriter, r *http.Request) {
	var req labRunStartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	dir := normalizeLabPath(req.Path)
	if dir == "" {
		writeError(w, http.StatusBadRequest, "path is required")
		return
	}
	if h.labRegistry == nil || !h.labRegistry.allows(dir) {
		writeError(w, http.StatusForbidden, "каталог не в реестре лабы: "+dir)
		return
	}
	lab := strings.TrimSpace(req.Lab)
	if lab == "" || strings.ContainsAny(lab, `/\`) || strings.Contains(lab, "..") {
		writeError(w, http.StatusBadRequest, "lab is required and must be a plain name")
		return
	}
	runner, ok := labRunnerScript(dir)
	if !ok {
		writeError(w, http.StatusBadRequest,
			"в проекте нет lab-run.mjs — запускать замер нечем; проект гоняет лабы своим способом")
		return
	}
	script, ok := labScriptFile(dir, lab)
	if !ok {
		writeError(w, http.StatusNotFound, "файл замера не найден: labs/"+lab)
		return
	}

	proc := &labRunProcess{
		Path: dir, Lab: lab,
		Started: time.Now().UTC().Format(time.RFC3339),
		subs:    map[chan string]struct{}{},
	}
	// Флага --paid здесь нет намеренно: без него каркас пропускает платные
	// ячейки сам, и кнопка не может потратить деньги.
	cmd := exec.Command("node", runner, script)
	cmd.Dir = dir
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	cmd.Stderr = cmd.Stdout // вывод замера идёт в оба потока; экрану нужен один
	if err := cmd.Start(); err != nil {
		writeError(w, http.StatusInternalServerError, "не удалось запустить node: "+err.Error())
		return
	}
	proc.cmd = cmd
	if h.labRuns == nil {
		h.labRuns = newLabRunRegistry()
	}
	h.labRuns.add(proc)

	go func() {
		scanner := bufio.NewScanner(stdout)
		scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
		for scanner.Scan() {
			proc.append(scanner.Text())
		}
		exitCode, failure := 0, ""
		if err := cmd.Wait(); err != nil {
			failure = err.Error()
			if ee, ok := err.(*exec.ExitError); ok {
				exitCode = ee.ExitCode()
			} else {
				exitCode = -1
			}
		}
		// Отчёт уходит в архив сразу: следующий прогон затрёт lab-out, и
		// сравнивать станет не с чем.
		if h.labHistoryPath != "" {
			if _, err := archiveLabReport(h.labHistoryPath, dir, lab); err != nil {
				proc.append("[gmind] отчёт не удалось положить в архив: " + err.Error())
			}
		}
		proc.finish(exitCode, failure)
	}()

	writeJSON(w, http.StatusOK, proc.status())
}

// GetLabRunStatus — GET /api/v1/lab/runs/{runID}/status
func (h *Handler) GetLabRunStatus(w http.ResponseWriter, r *http.Request) {
	proc := h.lookupLabRun(w, r)
	if proc == nil {
		return
	}
	writeJSON(w, http.StatusOK, proc.status())
}

// StopLabRun — POST /api/v1/lab/runs/{runID}/stop
func (h *Handler) StopLabRun(w http.ResponseWriter, r *http.Request) {
	proc := h.lookupLabRun(w, r)
	if proc == nil {
		return
	}
	proc.mu.Lock()
	done, cmd := proc.done, proc.cmd
	proc.mu.Unlock()
	if !done && cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
	writeJSON(w, http.StatusOK, proc.status())
}

func (h *Handler) lookupLabRun(w http.ResponseWriter, r *http.Request) *labRunProcess {
	id := chi.URLParam(r, "runID")
	if h.labRuns == nil {
		writeError(w, http.StatusNotFound, "прогон не найден: "+id)
		return nil
	}
	proc := h.labRuns.get(id)
	if proc == nil {
		writeError(w, http.StatusNotFound, "прогон не найден: "+id)
		return nil
	}
	return proc
}

// StreamLabRun — GET /api/v1/lab/runs/{runID}/stream
//
// Сначала отдаётся накопленное, затем живые строки: подключившийся посреди
// прогона видит его целиком, а не с середины.
func (h *Handler) StreamLabRun(w http.ResponseWriter, r *http.Request) {
	proc := h.lookupLabRun(w, r)
	if proc == nil {
		return
	}
	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	lines, ch, done := proc.snapshot()
	for _, line := range lines {
		writeLabSSE(w, "line", line)
	}
	flusher.Flush()

	if done {
		writeLabSSEJSON(w, "done", proc.status())
		flusher.Flush()
		return
	}
	defer proc.unsubscribe(ch)

	for {
		select {
		case <-r.Context().Done():
			return
		case line, open := <-ch:
			if !open {
				writeLabSSEJSON(w, "done", proc.status())
				flusher.Flush()
				return
			}
			writeLabSSE(w, "line", line)
			flusher.Flush()
		}
	}
}

func writeLabSSE(w io.Writer, event, data string) {
	// Перевод строки внутри данных разорвал бы кадр SSE — экранируем построчно.
	for _, part := range strings.Split(data, "\n") {
		fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, part)
	}
}

func writeLabSSEJSON(w io.Writer, event string, payload any) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, raw)
}
