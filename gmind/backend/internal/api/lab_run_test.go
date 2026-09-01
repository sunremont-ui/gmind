package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
)

// makeRunnableProject — проект с обёрткой lab-run.mjs, которая печатает строки
// и завершается. Настоящий каркас замеров тут не нужен: проверяется мост, а не
// он.
func makeRunnableProject(t *testing.T, script string) string {
	t.Helper()
	dir := makeLabProject(t, "GM", "gmind", false)
	if err := os.WriteFile(filepath.Join(dir, "lab-run.mjs"), []byte(script), 0o644); err != nil {
		t.Fatal(err)
	}
	return dir
}

func startRun(t *testing.T, h *Handler, dir, lab string) map[string]any {
	t.Helper()
	body := strings.NewReader(`{"path":` + jsonString(dir) + `,"lab":"` + lab + `"}`)
	rec := httptest.NewRecorder()
	h.StartLabRun(rec, httptest.NewRequest(http.MethodPost, "/api/v1/lab/runs/start", body))
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
	}
	var status map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	return status
}

func waitRunDone(t *testing.T, h *Handler, id string) map[string]any {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		proc := h.labRuns.get(id)
		if proc == nil {
			t.Fatalf("прогон %s пропал из реестра", id)
		}
		st := proc.status()
		if done, _ := st["done"].(bool); done {
			return st
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("прогон %s не завершился за 20 с", id)
	return nil
}

func TestStartLabRunStreamsOutputAndFinishes(t *testing.T) {
	h := labHandler(t)
	h.labRuns = newLabRunRegistry()
	dir := makeRunnableProject(t, `
		console.log('аргументы: ' + process.argv.slice(2).join(' '));
		console.log('ячеек к прогону: 2');
	`)
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	status := startRun(t, h, dir, "demo")
	id, _ := status["id"].(string)
	if id == "" {
		t.Fatal("прогон не получил id")
	}
	final := waitRunDone(t, h, id)
	if code, _ := final["exit_code"].(int); code != 0 {
		t.Errorf("код возврата %v, ожидался 0 (%v)", code, final["failure"])
	}

	proc := h.labRuns.get(id)
	lines, _, _ := proc.snapshot()
	joined := strings.Join(lines, "\n")
	if !strings.Contains(joined, "ячеек к прогону: 2") {
		t.Errorf("вывод замера не дошёл: %q", joined)
	}
	// Обёртке передаётся путь файла замера, найденный по имени.
	if !strings.Contains(joined, "labs/demo.lab.mjs") {
		t.Errorf("обёртка получила не тот аргумент: %q", joined)
	}
	// ⚠️ Главное: кнопка не может потратить деньги. Без --paid каркас пропускает
	// платные ячейки сам, и флаг не должен появляться ни при каких входных данных.
	if strings.Contains(joined, "--paid") {
		t.Error("в аргументы прогона просочился --paid — кнопка получила право тратить деньги")
	}
}

func TestStartLabRunRejectsUnregisteredAndBadNames(t *testing.T) {
	h := labHandler(t)
	h.labRuns = newLabRunRegistry()
	dir := makeRunnableProject(t, "console.log('ok')")

	// Каталог ещё не в реестре.
	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"path":` + jsonString(dir) + `,"lab":"demo"}`)
	h.StartLabRun(rec, httptest.NewRequest(http.MethodPost, "/api/v1/lab/runs/start", body))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("незарегистрированный каталог: статус %d, ожидался 403", rec.Code)
	}

	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}
	for _, lab := range []string{"", "../secret", `..\secret`, "sub/demo"} {
		rec := httptest.NewRecorder()
		body := strings.NewReader(`{"path":` + jsonString(dir) + `,"lab":"` + lab + `"}`)
		h.StartLabRun(rec, httptest.NewRequest(http.MethodPost, "/api/v1/lab/runs/start", body))
		if rec.Code != http.StatusBadRequest {
			t.Errorf("lab=%q: статус %d, ожидался 400", lab, rec.Code)
		}
	}
}

// Проект без обёртки не запускается, и отказ объясняет причину: угадывать чужой
// способ запуска нечем.
func TestStartLabRunRefusesProjectWithoutRunner(t *testing.T) {
	h := labHandler(t)
	h.labRuns = newLabRunRegistry()
	dir := makeLabProject(t, "MAS", "default", false) // lab-run.mjs нет
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	body := strings.NewReader(`{"path":` + jsonString(dir) + `,"lab":"demo"}`)
	h.StartLabRun(rec, httptest.NewRequest(http.MethodPost, "/api/v1/lab/runs/start", body))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("статус %d, ожидался 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "lab-run.mjs") {
		t.Errorf("отказ не называет причину: %s", rec.Body.String())
	}
}

// Ненулевой код возврата — это результат замера (гейт не сошёлся), а не сбой
// моста: прогон завершается штатно и код виден в статусе.
func TestFailedLabRunKeepsExitCode(t *testing.T) {
	h := labHandler(t)
	h.labRuns = newLabRunRegistry()
	dir := makeRunnableProject(t, "console.log('гейт не сошёлся'); process.exit(3);")
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}

	status := startRun(t, h, dir, "demo")
	final := waitRunDone(t, h, status["id"].(string))
	// ⚠️ Приведение именно к int: status() отдаёт Go-карту, а не разобранный JSON.
	// Ошибочное .(float64) давало ноль по умолчанию — и тест, ждущий ноль,
	// проходил бы при любом коде возврата.
	if code, _ := final["exit_code"].(int); code != 3 {
		t.Errorf("код возврата %v (%T), ожидался 3; сбой: %v", final["exit_code"], final["exit_code"], final["failure"])
	}
}

func TestStreamLabRunReplaysBufferedOutput(t *testing.T) {
	h := labHandler(t)
	h.labRuns = newLabRunRegistry()
	dir := makeRunnableProject(t, "console.log('строка замера');")
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}
	status := startRun(t, h, dir, "demo")
	id := status["id"].(string)
	waitRunDone(t, h, id)

	// Подключение ПОСЛЕ завершения обязано отдать весь вывод, а не пустоту.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/lab/runs/"+id+"/stream", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("runID", id)
	h.StreamLabRun(rec, req.WithContext(withChiCtx(req, rctx)))

	body := rec.Body.String()
	if !strings.Contains(body, "event: line") || !strings.Contains(body, "строка замера") {
		t.Errorf("поток не отдал накопленное: %q", body)
	}
	if !strings.Contains(body, "event: done") {
		t.Errorf("поток не сообщил о завершении: %q", body)
	}
}

func TestStopLabRunKillsProcess(t *testing.T) {
	h := labHandler(t)
	h.labRuns = newLabRunRegistry()
	// Замер, который сам не кончится.
	dir := makeRunnableProject(t, "setInterval(() => console.log('тик'), 50);")
	if _, err := h.labRegistry.add(labRegistryEntry{Path: dir}); err != nil {
		t.Fatal(err)
	}
	status := startRun(t, h, dir, "demo")
	id := status["id"].(string)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/lab/runs/"+id+"/stop", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("runID", id)
	h.StopLabRun(rec, req.WithContext(withChiCtx(req, rctx)))
	if rec.Code != http.StatusOK {
		t.Fatalf("статус %d: %s", rec.Code, rec.Body.String())
	}
	final := waitRunDone(t, h, id)
	if done, _ := final["done"].(bool); !done {
		t.Error("остановленный прогон не отмечен завершённым")
	}
}

// withChiCtx кладёт параметры маршрута в контекст запроса: обработчики берут
// runID через chi.URLParam, а httptest роутер не проходит.
func withChiCtx(r *http.Request, rctx *chi.Context) context.Context {
	return context.WithValue(r.Context(), chi.RouteCtxKey, rctx)
}
