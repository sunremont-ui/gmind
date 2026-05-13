package model

import "github.com/google/uuid"

func NewSheet(title string) *Sheet {
	sheet := &Sheet{
		ID:    uuid.New().String(),
		Title: title,
		RootTopic: &Topic{
			ID:    uuid.New().String(),
			Title: title,
		},
		Relationships:  []*Relationship{},
		FloatingTopics: []*Topic{},
	}
	return sheet
}

func (s *Sheet) AddRelationship(rel *Relationship) {
	s.Relationships = append(s.Relationships, rel)
}

func (s *Sheet) RemoveRelationship(relID string) {
	for i, r := range s.Relationships {
		if r.ID == relID {
			s.Relationships = append(s.Relationships[:i], s.Relationships[i+1:]...)
			return
		}
	}
}

func (s *Sheet) FindTopic(topicID string) *Topic {
	if s.RootTopic.ID == topicID {
		return s.RootTopic
	}
	if found := findTopicRecursive(s.RootTopic, topicID); found != nil {
		return found
	}
	for _, ft := range s.FloatingTopics {
		if ft.ID == topicID {
			return ft
		}
		if found := findTopicRecursive(ft, topicID); found != nil {
			return found
		}
	}
	return nil
}

func (s *Sheet) AddFloatingTopic(topic *Topic) {
	s.FloatingTopics = append(s.FloatingTopics, topic)
}

func (s *Sheet) RemoveFloatingTopic(topicID string) bool {
	for i, ft := range s.FloatingTopics {
		if ft.ID == topicID {
			s.FloatingTopics = append(s.FloatingTopics[:i], s.FloatingTopics[i+1:]...)
			return true
		}
	}
	return false
}

func findTopicRecursive(topic *Topic, id string) *Topic {
	if topic.ID == id {
		return topic
	}
	for _, child := range topic.Children {
		if found := findTopicRecursive(child, id); found != nil {
			return found
		}
	}
	return nil
}
