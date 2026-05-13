package xmind

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/gmind/backend/internal/model"
)

type ImportedSheet struct {
	ID            string                 `json:"id"`
	Title         string                 `json:"title"`
	Topic         ImportedTopic          `json:"topic"`
	Relationships []ImportedRelationship `json:"relationships,omitempty"`
}

type ImportedTopic struct {
	ID       string            `json:"id"`
	Title    string            `json:"title"`
	Children *ImportedChildren `json:"children,omitempty"`
	Notes    string            `json:"notes,omitempty"`
	Markers  []string          `json:"markers,omitempty"`
	Labels   []string          `json:"labels,omitempty"`
	Folded   bool              `json:"folded,omitempty"`
}

type ImportedChildren struct {
	Attached []ImportedTopic `json:"attached"`
}

type ImportedRelationship struct {
	ID     string `json:"id"`
	Title  string `json:"title,omitempty"`
	End1ID string `json:"end1_id"`
	End2ID string `json:"end2_id"`
}

func ParseXMind(data []byte) ([]ImportedSheet, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open zip: %w", err)
	}

	var contentData []byte
	for _, file := range reader.File {
		if file.Name == "content.json" {
			r, err := file.Open()
			if err != nil {
				return nil, fmt.Errorf("open content.json: %w", err)
			}
			defer r.Close()
			contentData, err = io.ReadAll(r)
			if err != nil {
				return nil, fmt.Errorf("read content.json: %w", err)
			}
			break
		}
	}

	if contentData == nil {
		return nil, errors.New("content.json not found in .xmind file")
	}

	// XMind content.json can be either:
	// 1. An object: {"version": "2.0", "sheets": [...]}
	// 2. An array: [{...sheet...}, {...sheet...}]
	// Try array first (modern XMind format), then object (legacy)

	contentData = bytes.TrimSpace(contentData)

	if len(contentData) > 0 && contentData[0] == '[' {
		// JSON array format: [...sheets]
		var sheets []ImportedSheet
		if err := json.Unmarshal(contentData, &sheets); err != nil {
			return nil, fmt.Errorf("parse content.json array: %w", err)
		}
		return sheets, nil
	}

	// JSON object format: {"sheets": [...]}
	var obj struct {
		Sheets []ImportedSheet `json:"sheets"`
	}
	if err := json.Unmarshal(contentData, &obj); err != nil {
		return nil, fmt.Errorf("parse content.json object: %w", err)
	}

	return obj.Sheets, nil
}

func ConvertToWorkbook(sheets []ImportedSheet, title string) *model.Workbook {
	wb := model.NewWorkbook(title)
	wb.Sheets = nil // remove default sheet

	for _, is := range sheets {
		sheet := &model.Sheet{
			ID:        is.ID,
			Title:     is.Title,
			RootTopic: convertImportedTopic(&is.Topic),
		}

		for _, ir := range is.Relationships {
			sheet.Relationships = append(sheet.Relationships, &model.Relationship{
				ID:     ir.ID,
				Title:  ir.Title,
				End1ID: ir.End1ID,
				End2ID: ir.End2ID,
			})
		}

		wb.Sheets = append(wb.Sheets, sheet)
	}

	return wb
}

func convertImportedTopic(it *ImportedTopic) *model.Topic {
	topic := &model.Topic{
		ID:       it.ID,
		Title:    it.Title,
		Notes:    it.Notes,
		Markers:  it.Markers,
		Labels:   it.Labels,
		Folded:   it.Folded,
		Children: []*model.Topic{},
	}

	if it.Children != nil {
		for _, child := range it.Children.Attached {
			topic.Children = append(topic.Children, convertImportedTopic(&child))
		}
	}

	return topic
}
