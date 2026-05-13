package xmind

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"

	"github.com/gmind/backend/internal/model"
)

type XMindContent struct {
	Version string       `json:"version"`
	Sheets  []XMindSheet `json:"sheets"`
}

type XMindSheet struct {
	ID            string              `json:"id"`
	Title         string              `json:"title"`
	Topic         XMindTopic          `json:"topic"`
	Relationships []XMindRelationship `json:"relationships,omitempty"`
}

type XMindTopic struct {
	ID       string         `json:"id"`
	Title    string         `json:"title"`
	Children *XMindChildren `json:"children,omitempty"`
	Notes    string         `json:"notes,omitempty"`
	Markers  []string       `json:"markers,omitempty"`
	Labels   []string       `json:"labels,omitempty"`
	Folded   bool           `json:"folded,omitempty"`
}

type XMindChildren struct {
	Attached []XMindTopic `json:"attached"`
}

type XMindRelationship struct {
	ID     string `json:"id"`
	Title  string `json:"title,omitempty"`
	End1ID string `json:"end1_id"`
	End2ID string `json:"end2_id"`
}

type XMindManifest struct {
	FileEntries map[string]XMindFileEntry `json:"file_entries"`
}

type XMindFileEntry struct {
	ContentType string `json:"content_type"`
}

func Export(wb *model.Workbook) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	xw := XMindContent{
		Version: "2.0",
	}

	for _, sheet := range wb.Sheets {
		xs := XMindSheet{
			ID:    sheet.ID,
			Title: sheet.Title,
			Topic: convertTopic(sheet.RootTopic),
		}
		for _, rel := range sheet.Relationships {
			xs.Relationships = append(xs.Relationships, XMindRelationship{
				ID:     rel.ID,
				Title:  rel.Title,
				End1ID: rel.End1ID,
				End2ID: rel.End2ID,
			})
		}
		xw.Sheets = append(xw.Sheets, xs)
	}

	contentData, err := json.MarshalIndent(xw, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal content: %w", err)
	}

	manifest := XMindManifest{
		FileEntries: map[string]XMindFileEntry{
			"content.json": {ContentType: "application/json"},
		},
	}
	manifestData, _ := json.MarshalIndent(manifest, "", "  ")

	files := map[string][]byte{
		"content.json":          contentData,
		"manifest.json":         manifestData,
		"META-INF/manifest.xml": []byte(`<?xml version="1.0" encoding="UTF-8"?><manifest xmlns="urn:xmind:xmap:xmlns:manifest:2.0"><file-entry full-path="content.json" media-type="application/json"/></manifest>`),
	}

	for name, data := range files {
		f, err := zw.Create(name)
		if err != nil {
			return nil, fmt.Errorf("create zip entry %s: %w", name, err)
		}
		if _, err := f.Write(data); err != nil {
			return nil, fmt.Errorf("write %s: %w", name, err)
		}
	}

	if err := zw.Close(); err != nil {
		return nil, fmt.Errorf("close zip: %w", err)
	}

	return buf.Bytes(), nil
}

func convertTopic(t *model.Topic) XMindTopic {
	xt := XMindTopic{
		ID:      t.ID,
		Title:   t.Title,
		Notes:   t.Notes,
		Markers: t.Markers,
		Labels:  t.Labels,
		Folded:  t.Folded,
	}

	if len(t.Children) > 0 {
		children := XMindChildren{}
		for _, child := range t.Children {
			children.Attached = append(children.Attached, convertTopic(child))
		}
		xt.Children = &children
	}

	return xt
}
