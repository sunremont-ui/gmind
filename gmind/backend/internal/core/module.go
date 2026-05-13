package core

import (
	"context"
	"time"
)

// HealthStatus represents module health state.
type HealthStatus int

const (
	HealthUnknown HealthStatus = iota
	HealthHealthy
	HealthDegraded
	HealthUnhealthy
)

func (h HealthStatus) String() string {
	switch h {
	case HealthHealthy:
		return "healthy"
	case HealthDegraded:
		return "degraded"
	case HealthUnhealthy:
		return "unhealthy"
	default:
		return "unknown"
	}
}

// Module is the core interface every module must implement.
type Module interface {
	ID() string
	Name() string
	Version() string
	Dependencies() []string
	Init(ctx context.Context, deps *Dependencies) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	Health() HealthStatus
}

// Dependencies are injected into each module during Init.
type Dependencies struct {
	EventBus EventBus
	Store    Store
	Logger   Logger
	Config   Provider
}

// Store interface for database access (minimal subset for modules).
// Modules needing specific DB access should define their own interfaces
// and rely on dependency injection of the concrete store.
type Store interface {
	Close() error
}

// Logger interface for structured logging.
type Logger interface {
	Info(msg string, args ...any)
	Warn(msg string, args ...any)
	Error(msg string, args ...any)
	Debug(msg string, args ...any)
}

// Provider interface for configuration.
type Provider interface {
	Get(key string) string
	GetInt(key string, fallback int) int
	GetBool(key string, fallback bool) bool
}

// Event represents a system-wide event for pub-sub communication.
type Event struct {
	Type      string
	Source    string
	Timestamp time.Time
	Payload   map[string]any
}

// EventHandler is a callback for event subscription.
type EventHandler func(Event)

// EventBus defines the pub-sub interface for module communication.
type EventBus interface {
	Publish(event Event)
	Subscribe(eventType string, handler EventHandler) func()
	SubscribeGlobally(handler EventHandler) func()
}

// ModuleInfo is a summary of a registered module.
type ModuleInfo struct {
	ID           string       `json:"id"`
	Name         string       `json:"name"`
	Version      string       `json:"version"`
	Dependencies []string     `json:"dependencies"`
	Health       HealthStatus `json:"health"`
}
