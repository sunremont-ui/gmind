package core

import (
	"sync"
	"time"
)

type eventBus struct {
	mu       sync.RWMutex
	handlers map[string][]EventHandler
	global   []EventHandler
}

// NewEventBus creates a new in-memory event bus.
func NewEventBus() EventBus {
	return &eventBus{
		handlers: make(map[string][]EventHandler),
	}
}

func (b *eventBus) Publish(event Event) {
	event.Timestamp = time.Now()

	b.mu.RLock()
	handlers := b.handlers[event.Type]
	global := b.global
	b.mu.RUnlock()

	// Copy slices to avoid holding the lock during handler execution
	handlersCopy := make([]EventHandler, len(handlers))
	copy(handlersCopy, handlers)
	globalCopy := make([]EventHandler, len(global))
	copy(globalCopy, global)

	for _, h := range handlersCopy {
		h(event)
	}
	for _, h := range globalCopy {
		h(event)
	}
}

func (b *eventBus) Subscribe(eventType string, handler EventHandler) func() {
	b.mu.Lock()
	b.handlers[eventType] = append(b.handlers[eventType], handler)
	b.mu.Unlock()

	return func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		handlers := b.handlers[eventType]
		for i, h := range handlers {
			if &h == &handler {
				b.handlers[eventType] = append(handlers[:i], handlers[i+1:]...)
				break
			}
		}
	}
}

func (b *eventBus) SubscribeGlobally(handler EventHandler) func() {
	b.mu.Lock()
	b.global = append(b.global, handler)
	b.mu.Unlock()

	return func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		for i, h := range b.global {
			if &h == &handler {
				b.global = append(b.global[:i], b.global[i+1:]...)
				break
			}
		}
	}
}
