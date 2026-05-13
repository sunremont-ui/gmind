package core

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"sync"
)

// Registry manages module lifecycle and dependency resolution.
type Registry struct {
	mu      sync.RWMutex
	modules map[string]Module
	deps    *Dependencies
	started bool
}

// NewRegistry creates a new module registry.
func NewRegistry(deps *Dependencies) *Registry {
	return &Registry{
		modules: make(map[string]Module),
		deps:    deps,
	}
}

// Register adds a module to the registry. If the system is already started,
// the module is initialized and started immediately.
func (r *Registry) Register(m Module) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	id := m.ID()
	if _, exists := r.modules[id]; exists {
		return fmt.Errorf("module %s already registered", id)
	}

	r.modules[id] = m
	r.deps.Logger.Info("module registered", "id", id, "name", m.Name(), "version", m.Version())

	// Publish event asynchronously
	if r.deps.EventBus != nil {
		r.deps.EventBus.Publish(Event{
			Type:   "module:registered",
			Source: "core",
			Payload: map[string]any{
				"id":      id,
				"name":    m.Name(),
				"version": m.Version(),
			},
		})
	}

	// If already started, init and start the new module immediately
	if r.started {
		ctx := context.Background()
		if err := m.Init(ctx, r.deps); err != nil {
			return fmt.Errorf("module %s init failed: %w", id, err)
		}
		if err := m.Start(ctx); err != nil {
			return fmt.Errorf("module %s start failed: %w", id, err)
		}
		r.deps.Logger.Info("module started (hot)", "id", id)
	}

	return nil
}

// Unregister removes a module from the registry.
func (r *Registry) Unregister(id string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	m, exists := r.modules[id]
	if !exists {
		return
	}

	if r.started {
		ctx := context.Background()
		if err := m.Stop(ctx); err != nil {
			r.deps.Logger.Warn("module stop error", "id", id, "error", err)
		}
	}

	delete(r.modules, id)
	r.deps.Logger.Info("module unregistered", "id", id)

	if r.deps.EventBus != nil {
		r.deps.EventBus.Publish(Event{
			Type:   "module:removed",
			Source: "core",
			Payload: map[string]any{
				"id": id,
			},
		})
	}
}

// StartAll initializes and starts all modules in dependency order.
func (r *Registry) StartAll(ctx context.Context) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	ordered, err := r.topoSort()
	if err != nil {
		return fmt.Errorf("dependency resolution failed: %w", err)
	}

	for _, m := range ordered {
		if err := m.Init(ctx, r.deps); err != nil {
			return fmt.Errorf("module %s init: %w", m.ID(), err)
		}
		r.deps.Logger.Debug("module initialized", "id", m.ID())
	}

	for _, m := range ordered {
		if err := m.Start(ctx); err != nil {
			return fmt.Errorf("module %s start: %w", m.ID(), err)
		}
		r.deps.Logger.Info("module started", "id", m.ID(), "name", m.Name())
	}

	r.started = true
	return nil
}

// StopAll stops all modules in reverse dependency order.
func (r *Registry) StopAll(ctx context.Context) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if !r.started {
		return
	}

	ordered, err := r.topoSort()
	if err != nil {
		// Fallback: stop in reverse map order
		for id, m := range r.modules {
			if err := m.Stop(ctx); err != nil {
				r.deps.Logger.Warn("module stop error", "id", id, "error", err)
			}
		}
		return
	}

	// Reverse order for stop
	for i := len(ordered) - 1; i >= 0; i-- {
		m := ordered[i]
		if err := m.Stop(ctx); err != nil {
			r.deps.Logger.Warn("module stop error", "id", m.ID(), "error", err)
		}
		r.deps.Logger.Info("module stopped", "id", m.ID())
	}

	r.started = false
}

// Get returns a module by ID.
func (r *Registry) Get(id string) Module {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.modules[id]
}

// List returns info for all registered modules.
func (r *Registry) List() []ModuleInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]ModuleInfo, 0, len(r.modules))
	for _, m := range r.modules {
		result = append(result, ModuleInfo{
			ID:           m.ID(),
			Name:         m.Name(),
			Version:      m.Version(),
			Dependencies: m.Dependencies(),
			Health:       m.Health(),
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].ID < result[j].ID
	})
	return result
}

// topoSort returns modules in dependency order (Kahn's algorithm).
func (r *Registry) topoSort() ([]Module, error) {
	inDegree := make(map[string]int)
	dependents := make(map[string][]string) // who depends on whom
	moduleMap := make(map[string]Module)

	for _, m := range r.modules {
		id := m.ID()
		moduleMap[id] = m
		if _, ok := inDegree[id]; !ok {
			inDegree[id] = 0
		}
		for _, dep := range m.Dependencies() {
			if _, exists := r.modules[dep]; !exists {
				return nil, fmt.Errorf("module %s depends on %s which is not registered", id, dep)
			}
			dependents[dep] = append(dependents[dep], id)
			inDegree[id]++
		}
	}

	var queue []string
	for id, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, id)
		}
	}

	var result []Module
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		result = append(result, moduleMap[id])
		for _, dep := range dependents[id] {
			inDegree[dep]--
			if inDegree[dep] == 0 {
				queue = append(queue, dep)
			}
		}
	}

	if len(result) != len(r.modules) {
		return nil, errors.New("circular dependency detected")
	}

	return result, nil
}
