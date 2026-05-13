package model

import (
	"time"

	"github.com/google/uuid"
)

func NewWorkbook(title string, ownerID ...string) *Workbook {
	now := time.Now().UTC()
	wb := &Workbook{
		ID:        uuid.New().String(),
		Title:     title,
		Sheets:    []*Sheet{},
		CreatedAt: now,
		UpdatedAt: now,
	}
	if len(ownerID) > 0 {
		wb.OwnerID = ownerID[0]
	}
	return wb
}

func (wb *Workbook) AddSheet(sheet *Sheet) {
	wb.Sheets = append(wb.Sheets, sheet)
	wb.UpdatedAt = time.Now().UTC()
}

func (wb *Workbook) RemoveSheet(sheetID string) {
	for i, s := range wb.Sheets {
		if s.ID == sheetID {
			wb.Sheets = append(wb.Sheets[:i], wb.Sheets[i+1:]...)
			break
		}
	}
	wb.UpdatedAt = time.Now().UTC()
}

func (wb *Workbook) GetSheet(sheetID string) *Sheet {
	for _, s := range wb.Sheets {
		if s.ID == sheetID {
			return s
		}
	}
	return nil
}
