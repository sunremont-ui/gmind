package model

import "github.com/google/uuid"

func NewTopic(title string) *Topic {
	return &Topic{
		ID:    uuid.New().String(),
		Title: title,
	}
}

func (t *Topic) DeepCopy() *Topic {
	copy := &Topic{
		ID:         uuid.New().String(),
		Title:      t.Title,
		Notes:      t.Notes,
		Markers:    append([]string{}, t.Markers...),
		Labels:     append([]string{}, t.Labels...),
		Hyperlink:  t.Hyperlink,
		Image:      t.Image,
		Folded:     t.Folded,
		Structure:  t.Structure,
		BranchSide: t.BranchSide,
		EdgeStyle:  t.EdgeStyle,
		EdgeDash:   t.EdgeDash,
		FontSize:   t.FontSize,
		FontColor:  t.FontColor,
		NodeWidth:  t.NodeWidth,
		Icon:       t.Icon,
	}
	if t.Position != nil {
		copy.Position = &Position{X: t.Position.X, Y: t.Position.Y}
	}
	for _, child := range t.Children {
		copy.Children = append(copy.Children, child.DeepCopy())
	}
	return copy
}

func (t *Topic) AddChild(child *Topic) {
	t.Children = append(t.Children, child)
}

func (t *Topic) RemoveChild(childID string) {
	for i, c := range t.Children {
		if c.ID == childID {
			t.Children = append(t.Children[:i], t.Children[i+1:]...)
			return
		}
	}
}

func (t *Topic) InsertChildAt(index int, child *Topic) {
	if index < 0 || index > len(t.Children) {
		index = len(t.Children)
	}
	t.Children = append(t.Children[:index], append([]*Topic{child}, t.Children[index:]...)...)
}

func NewRelationship(title, end1ID, end2ID string) *Relationship {
	return &Relationship{
		ID:     uuid.New().String(),
		Title:  title,
		End1ID: end1ID,
		End2ID: end2ID,
	}
}

func NewPosition(x, y float64) *Position {
	return &Position{X: x, Y: y}
}
