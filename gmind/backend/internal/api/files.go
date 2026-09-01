package api

import (
	"io"
	"mime"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

// Локальное хранилище вложений. Записи приходят из projectService вместе со
// скриншотами, фотографиями шильдиков и голосовыми — и карта должна открываться
// сама по себе, без запущенного чужого сервера. Поэтому байты копируются сюда
// (через пайплайн MASys, прямых обращений между проектами нет), а узел ссылается
// на локальный адрес.
//
// Ссылки на файлы отдаём как /api/v1/files/<ключ>: ключ повторяет раскладку
// источника (notes/<publicCode>/<файл>), поэтому по адресу видно, чьё вложение.

const maxFileBytes = 50 << 20 // 50 MB

// filesRoot — каталог хранилища вложений.
func (h *Handler) filesRoot() string {
	if h.filesPath != "" {
		return h.filesPath
	}
	return "files"
}

// resolveFileKey превращает ключ в путь внутри хранилища. Всё, что пытается
// выйти наружу (.., абсолютный путь, буква диска), отвергается.
func (h *Handler) resolveFileKey(key string) (string, string, error) {
	key = strings.TrimSpace(strings.ReplaceAll(key, "\\", "/"))
	key = strings.TrimPrefix(key, "/")
	if key == "" {
		return "", "", upsertError("file key is required")
	}
	if filepath.IsAbs(key) || strings.Contains(key, ":") {
		return "", "", upsertError("file key must be relative")
	}
	clean := path.Clean(key)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", "", upsertError("file key must stay inside the store")
	}
	return clean, filepath.Join(h.filesRoot(), filepath.FromSlash(clean)), nil
}

// PutFile — PUT /api/v1/files/{key...}
// Тело запроса — сами байты. Повторная заливка того же ключа перезаписывает
// файл: синхронизация идемпотентна и не плодит копий.
func (h *Handler) PutFile(w http.ResponseWriter, r *http.Request) {
	key, full, err := h.resolveFileKey(chi.URLParam(r, "*"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		internalError(w, err)
		return
	}

	// Пишем во временный файл рядом: оборванная передача не оставит
	// полуфайл под рабочим именем.
	tmp, err := os.CreateTemp(filepath.Dir(full), ".upload-*")
	if err != nil {
		internalError(w, err)
		return
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	written, err := io.Copy(tmp, http.MaxBytesReader(w, r.Body, maxFileBytes))
	closeErr := tmp.Close()
	if err != nil {
		writeError(w, http.StatusBadRequest, "upload failed: "+err.Error())
		return
	}
	if closeErr != nil {
		internalError(w, closeErr)
		return
	}
	if err := os.Rename(tmpName, full); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"key":  key,
		"size": written,
		"url":  "/api/v1/files/" + key,
	})
}

// GetFile — GET /api/v1/files/{key...}
// ServeContent, а не голая отдача: голосовые и кружки нужно уметь перематывать.
func (h *Handler) GetFile(w http.ResponseWriter, r *http.Request) {
	key, full, err := h.resolveFileKey(chi.URLParam(r, "*"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	f, err := os.Open(full)
	if err != nil {
		if os.IsNotExist(err) {
			writeError(w, http.StatusNotFound, "file not found")
			return
		}
		internalError(w, err)
		return
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		internalError(w, err)
		return
	}
	if info.IsDir() {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}
	if ct := mime.TypeByExtension(path.Ext(key)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeContent(w, r, path.Base(key), info.ModTime(), f)
}

// HeadFile — HEAD /api/v1/files/{key...}
// Источнику этого достаточно, чтобы не переливать уже лежащее вложение.
func (h *Handler) HeadFile(w http.ResponseWriter, r *http.Request) {
	_, full, err := h.resolveFileKey(chi.URLParam(r, "*"))
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	info, err := os.Stat(full)
	if err != nil || info.IsDir() {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.WriteHeader(http.StatusOK)
}

// DeleteFile — DELETE /api/v1/files/{key...}
func (h *Handler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	_, full, err := h.resolveFileKey(chi.URLParam(r, "*"))
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := os.Remove(full); err != nil && !os.IsNotExist(err) {
		internalError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
