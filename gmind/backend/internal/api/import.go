package api

import (
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/gmind/backend/internal/xmind"
)

func (h *Handler) ImportXMind(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 50<<20)

	var data []byte
	contentType := r.Header.Get("Content-Type")

	if strings.Contains(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(50 << 20); err != nil {
			log.Printf("import: parse multipart form error: %v", err)
			writeError(w, http.StatusBadRequest, "failed to parse multipart form: "+err.Error())
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			log.Printf("import: form file error: %v", err)
			writeError(w, http.StatusBadRequest, "missing file field: "+err.Error())
			return
		}
		defer file.Close()

		data, err = io.ReadAll(file)
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to read file")
			return
		}
	} else {
		var err error
		data, err = io.ReadAll(r.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to read body")
			return
		}
	}

	if len(data) == 0 {
		writeError(w, http.StatusBadRequest, "empty file")
		return
	}

	sheets, err := xmind.ParseXMind(data)
	if err != nil {
		log.Printf("import: parse xmind error: %v", err)
		writeError(w, http.StatusBadRequest, "invalid .xmind file: "+err.Error())
		return
	}

	title := r.FormValue("title")
	if title == "" {
		title = "Imported Mind Map"
		if len(sheets) > 0 {
			title = sheets[0].Title
		}
	}

	wb := xmind.ConvertToWorkbook(sheets, title)

	if err := h.store.CreateWorkbook(wb); err != nil {
		internalError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, wb)
}
