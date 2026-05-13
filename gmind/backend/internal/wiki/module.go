package wiki

import (
	"context"
	"sync"

	"github.com/gmind/backend/internal/core"
)

const (
	ModuleID      = "wiki"
	ModuleName    = "Wiki"
	ModuleVersion = "0.1.0"
)

type Module struct {
	mu       sync.RWMutex
	health   core.HealthStatus
	store    *Store
	eventBus core.EventBus
	logger   core.Logger
}

func NewModule(store *Store) *Module {
	return &Module{
		health: core.HealthUnknown,
		store:  store,
	}
}

func (m *Module) Store() *Store { return m.store }

func (m *Module) ID() string                { return ModuleID }
func (m *Module) Name() string              { return ModuleName }
func (m *Module) Version() string           { return ModuleVersion }
func (m *Module) Dependencies() []string    { return nil }
func (m *Module) Health() core.HealthStatus { return m.health }

func (m *Module) Init(ctx context.Context, deps *core.Dependencies) error {
	m.eventBus = deps.EventBus
	m.logger = deps.Logger
	m.logger.Info("wiki module initialized", "root", m.store.Root())
	return nil
}

func (m *Module) Start(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.health = core.HealthHealthy
	m.logger.Info("wiki module started")
	return nil
}

func (m *Module) Stop(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.health = core.HealthUnknown
	m.logger.Info("wiki module stopped")
	return nil
}
