package ws

import (
	"encoding/json"
	"testing"

	"github.com/gmind/backend/internal/model"
)

// registerClient adds a client to both clients map and workbook (like HandleWebSocket does).
func (h *Hub) registerClient(c *Client) {
	h.mu.Lock()
	h.clients[c.ID] = c
	h.mu.Unlock()
	h.register(c)
}

// drainPresence reads and discards one presence message from a client's send channel.
func drainPresence(c *Client) {
	select {
	case <-c.Send:
	default:
	}
}

// drainAll drains all messages from a client's send channel.
func drainAll(c *Client) {
	for {
		select {
		case <-c.Send:
		default:
			return
		}
	}
}

func newTestClient(id, userID, userName, userColor, workbookID string) *Client {
	return &Client{
		ID:         id,
		UserID:     userID,
		UserName:   userName,
		UserColor:  userColor,
		WorkbookID: workbookID,
		Send:       make(chan []byte, 10),
	}
}

func TestNewHub(t *testing.T) {
	h := NewHub()
	if h == nil {
		t.Fatal("NewHub returned nil")
	}
}

func TestRegisterAndUnregister(t *testing.T) {
	h := NewHub()

	c1 := newTestClient("c1", "user-1", "Alpha", "#ff0000", "wb-1")
	c2 := newTestClient("c2", "user-2", "Beta", "#00ff00", "wb-1")
	c3 := newTestClient("c3", "user-3", "", "", "wb-2")

	h.registerClient(c1)
	h.registerClient(c2)
	h.registerClient(c3)

	// Drain all presence messages
	drainAll(c1)
	drainAll(c2)
	drainAll(c3)

	// Check clients map
	h.mu.RLock()
	if len(h.clients) != 3 {
		t.Errorf("clients = %d, want 3", len(h.clients))
	}
	h.mu.RUnlock()

	// Check workbooks map
	h.mu.RLock()
	wb1 := h.workbooks["wb-1"]
	if len(wb1) != 2 {
		t.Errorf("wb-1 clients = %d, want 2", len(wb1))
	}
	wb2 := h.workbooks["wb-2"]
	if len(wb2) != 1 {
		t.Errorf("wb-2 clients = %d, want 1", len(wb2))
	}
	h.mu.RUnlock()

	// Unregister c1
	h.unregister(c1)

	h.mu.RLock()
	if len(h.clients) != 2 {
		t.Errorf("after unregister: clients = %d, want 2", len(h.clients))
	}
	wb1 = h.workbooks["wb-1"]
	if len(wb1) != 1 {
		t.Errorf("after unregister: wb-1 clients = %d, want 1", len(wb1))
	}
	h.mu.RUnlock()

	// Unregister last client from wb-2
	h.unregister(c3)

	h.mu.RLock()
	if _, ok := h.workbooks["wb-2"]; ok {
		t.Error("wb-2 should be deleted after last client")
	}
	h.mu.RUnlock()
}

func TestBroadcastToWorkbook(t *testing.T) {
	h := NewHub()

	c1 := newTestClient("c1", "", "", "", "wb-1")
	c2 := newTestClient("c2", "", "", "", "wb-1")
	c3 := newTestClient("c3", "", "", "", "wb-2")

	h.registerClient(c1)
	drainAll(c1) // drain c1 presence

	h.registerClient(c2)
	drainAll(c1) // drain presence broadcast to c1 when c2 joined
	drainAll(c2) // drain c2 presence

	h.registerClient(c3)
	drainAll(c3) // drain c3 presence

	msg := []byte(`{"type":"test"}`)
	h.broadcastToWorkbook("wb-1", msg, "")

	// c1 and c2 should receive the message
	select {
	case received := <-c1.Send:
		if string(received) != string(msg) {
			t.Errorf("c1 received %q, want %q", received, msg)
		}
	default:
		t.Error("c1 did not receive message")
	}

	select {
	case <-c2.Send:
	default:
		t.Error("c2 did not receive message")
	}

	// c3 should NOT receive the message (different workbook)
	select {
	case <-c3.Send:
		t.Error("c3 should not have received message")
	default:
	}
}

func TestBroadcastToWorkbookExclude(t *testing.T) {
	h := NewHub()

	c1 := newTestClient("c1", "", "", "", "wb-1")
	c2 := newTestClient("c2", "", "", "", "wb-1")

	h.registerClient(c1)
	drainAll(c1)

	h.registerClient(c2)
	drainAll(c1)
	drainAll(c2)

	msg := []byte(`{"type":"cursor"}`)
	h.broadcastToWorkbook("wb-1", msg, "c1")

	// c1 should NOT receive (excluded)
	select {
	case <-c1.Send:
		t.Error("c1 should be excluded from broadcast")
	default:
	}

	// c2 should receive
	select {
	case <-c2.Send:
	default:
		t.Error("c2 should have received message")
	}
}

func TestBroadcastAllPreservesChannels(t *testing.T) {
	h := NewHub()
	c1 := &Client{
		ID:         "c1",
		WorkbookID: "wb-1",
		Send:       make(chan []byte, 10),
	}
	h.registerClient(c1)
	// Drain any presence messages
	for i := 0; i < 3; i++ {
		drainPresence(c1)
	}

	h.BroadcastAll([]byte(`{"type":"global"}`))
	select {
	case <-c1.Send:
	default:
		t.Error("c1 should receive BroadcastAll")
	}
}

func TestBroadcastAll(t *testing.T) {
	h := NewHub()

	c1 := &Client{
		ID:         "c1",
		WorkbookID: "wb-1",
		Send:       make(chan []byte, 10),
	}
	c2 := &Client{
		ID:         "c2",
		WorkbookID: "wb-2",
		Send:       make(chan []byte, 10),
	}

	h.register(c1)
	h.register(c2)

	msg := []byte(`{"type":"broadcast_all"}`)
	h.BroadcastAll(msg)

	select {
	case <-c1.Send:
	default:
		t.Error("c1 should have received BroadcastAll")
	}
	select {
	case <-c2.Send:
	default:
		t.Error("c2 should have received BroadcastAll")
	}
}

func TestBroadcastPresence(t *testing.T) {
	h := NewHub()

	c1 := &Client{
		ID:         "c1",
		WorkbookID: "wb-1",
		UserID:     "user-1",
		UserName:   "Alpha",
		UserColor:  "#ff0000",
		Send:       make(chan []byte, 10),
	}

	h.register(c1)

	select {
	case msg := <-c1.Send:
		var wsMsg model.WSMessage
		if err := json.Unmarshal(msg, &wsMsg); err != nil {
			t.Fatalf("unmarshal presence: %v", err)
		}
		if wsMsg.Type != "presence" {
			t.Errorf("type = %s, want presence", wsMsg.Type)
		}
		_ = wsMsg.Payload
	default:
		t.Error("no presence message sent after register")
	}
}

func TestClientIDsAreUnique(t *testing.T) {
	h := NewHub()

	c1 := newTestClient("c1-id", "", "", "", "wb-1")
	c2 := newTestClient("c2-id", "", "", "", "wb-1")

	h.registerClient(c1)
	h.registerClient(c2)
	drainAll(c1)
	drainAll(c2)

	h.mu.RLock()
	defer h.mu.RUnlock()

	if h.clients["c1-id"] == nil {
		t.Error("c1-id not found in clients")
	}
	if h.clients["c2-id"] == nil {
		t.Error("c2-id not found in clients")
	}
	if h.clients["c1-id"] == h.clients["c2-id"] {
		t.Error("c1 and c2 should be different clients")
	}
}
