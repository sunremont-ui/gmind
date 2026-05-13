package core

import (
	"github.com/gmind/backend/internal/store"
)

// NewStoreAdapter wraps the application store into a core.Store.
func NewStoreAdapter(s *store.Store) Store {
	return &storeAdapter{s: s}
}

type storeAdapter struct {
	s *store.Store
}

func (a *storeAdapter) Close() error {
	return a.s.Close()
}
