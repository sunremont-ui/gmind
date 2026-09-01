package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/store"
)

// newFilesRouter поднимает роутер с хранилищем вложений во временном каталоге.
func newFilesRouter(t *testing.T) (http.Handler, string) {
	t.Helper()
	s, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })

	root := t.TempDir()
	h := New(s, nil, "", nil, nil)
	return h.Router(&config.Config{AllowedOrigins: []string{"*"}, FilesPath: root}), root
}

func putFile(t *testing.T, router http.Handler, key string, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("PUT", "/api/v1/files/"+key, bytes.NewReader(body))
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestPutAndGetFileRoundTrip(t *testing.T) {
	router, root := newFilesRouter(t)
	payload := []byte("байты фотографии шильдика")

	if w := putFile(t, router, "notes/N-20260804-A2B282/plate.jpg", payload); w.Code != http.StatusOK {
		t.Fatalf("put: status = %d, body = %s", w.Code, w.Body.String())
	}

	onDisk := filepath.Join(root, "notes", "N-20260804-A2B282", "plate.jpg")
	if got, err := os.ReadFile(onDisk); err != nil || !bytes.Equal(got, payload) {
		t.Fatalf("на диске: %v, %q", err, got)
	}

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/files/notes/N-20260804-A2B282/plate.jpg", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("get: status = %d", w.Code)
	}
	if !bytes.Equal(w.Body.Bytes(), payload) {
		t.Fatalf("вернулось не то: %q", w.Body.String())
	}
	if ct := w.Header().Get("Content-Type"); ct == "" {
		t.Fatal("Content-Type пуст — картинка не отрисуется в узле")
	}
}

// Повторная заливка того же ключа перезаписывает файл, а не создаёт копию:
// синхронизация вложений должна быть такой же идемпотентной, как и узлов.
func TestPutFileOverwrites(t *testing.T) {
	router, root := newFilesRouter(t)

	putFile(t, router, "notes/N-1/voice.ogg", []byte("первая версия"))
	putFile(t, router, "notes/N-1/voice.ogg", []byte("вторая"))

	entries, err := os.ReadDir(filepath.Join(root, "notes", "N-1"))
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("файлов в каталоге: %d, ожидался 1: %+v", len(entries), entries)
	}
	got, err := os.ReadFile(filepath.Join(root, "notes", "N-1", "voice.ogg"))
	if err != nil || string(got) != "вторая" {
		t.Fatalf("содержимое: %v, %q", err, got)
	}
}

// HEAD нужен источнику, чтобы не переливать уже лежащее вложение.
func TestHeadFileReportsPresence(t *testing.T) {
	router, _ := newFilesRouter(t)
	putFile(t, router, "notes/N-2/photo.jpg", []byte("12345"))

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("HEAD", "/api/v1/files/notes/N-2/photo.jpg", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("существующий файл: status = %d", w.Code)
	}
	if got := w.Header().Get("Content-Length"); got != "5" {
		t.Fatalf("Content-Length = %q", got)
	}

	missing := httptest.NewRecorder()
	router.ServeHTTP(missing, httptest.NewRequest("HEAD", "/api/v1/files/notes/N-2/nope.jpg", nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("отсутствующий файл: status = %d", missing.Code)
	}
}

// Ключ приходит извне, поэтому выход за пределы хранилища должен быть закрыт.
func TestFileKeyCannotEscapeStore(t *testing.T) {
	router, root := newFilesRouter(t)

	for _, key := range []string{"../outside.txt", "notes/../../outside.txt"} {
		if w := putFile(t, router, key, []byte("нельзя")); w.Code != http.StatusBadRequest {
			t.Fatalf("ключ %q: status = %d, body = %s", key, w.Code, w.Body.String())
		}
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(root), "outside.txt")); !os.IsNotExist(err) {
		t.Fatalf("файл записан наружу: %v", err)
	}
}

func TestDeleteFileIsIdempotent(t *testing.T) {
	router, _ := newFilesRouter(t)
	putFile(t, router, "notes/N-3/a.txt", []byte("x"))

	for i := 0; i < 2; i++ {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest("DELETE", "/api/v1/files/notes/N-3/a.txt", nil))
		if w.Code != http.StatusNoContent {
			t.Fatalf("удаление %d: status = %d", i, w.Code)
		}
	}
}
