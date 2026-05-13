package ws

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gmind/backend/internal/model"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type Client struct {
	ID         string
	WorkbookID string
	UserID     string
	UserName   string
	UserColor  string
	Conn       *websocket.Conn
	Send       chan []byte
}

// WorkbookStore is the interface Hub needs for private mode checks.
type WorkbookStore interface {
	GetWorkbook(id string) (*model.Workbook, error)
	GetCollaborators(workbookID string) ([]string, error)
}

type Hub struct {
	mu        sync.RWMutex
	clients   map[string]*Client
	workbooks map[string]map[string]*Client
	store     WorkbookStore
}

func NewHub(store ...WorkbookStore) *Hub {
	h := &Hub{
		clients:   make(map[string]*Client),
		workbooks: make(map[string]map[string]*Client),
	}
	if len(store) > 0 {
		h.store = store[0]
	}
	return h
}

func (h *Hub) Run() {
	// Hub runs as a background goroutine.
	// All state is managed via mutex locks.
	select {}
}

func (h *Hub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	client := &Client{
		ID:   uuid.New().String(),
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	h.mu.Lock()
	h.clients[client.ID] = client
	h.mu.Unlock()

	go client.writePump()
	client.readPump(h)
}

func (c *Client) readPump(hub *Hub) {
	defer func() {
		hub.unregister(c)
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var msg model.WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		msg.UserID = c.UserID

		switch msg.Type {
		case "join":
			var payload struct {
				WorkbookID string `json:"workbook_id"`
				UserID     string `json:"user_id"`
				UserName   string `json:"user_name"`
				UserColor  string `json:"user_color"`
			}
			json.Unmarshal([]byte(jsonEncode(msg.Payload)), &payload)

			// Check access mode
			if hub.store != nil {
				wb, err := hub.store.GetWorkbook(payload.WorkbookID)
				if err == nil && wb != nil {
					mode := wb.AccessMode
					if mode == "" {
						if wb.Private {
							mode = model.AccessModeCollaborators
						} else {
							mode = model.AccessModePublic
						}
					}
					switch mode {
					case model.AccessModePrivate:
						// Only owner (if set) may connect
						if wb.OwnerID != "" && payload.UserID != wb.OwnerID {
							errMsg, _ := json.Marshal(model.WSMessage{
								Type:    "error",
								Payload: map[string]string{"message": "workbook is private"},
							})
							c.Send <- errMsg
							return
						}
					case model.AccessModeCollaborators:
						allowed := wb.OwnerID != "" && payload.UserID == wb.OwnerID
						if !allowed && wb.OwnerID != "" {
							collabs, cerr := hub.store.GetCollaborators(payload.WorkbookID)
							if cerr == nil {
								for _, uid := range collabs {
									if uid == payload.UserID {
										allowed = true
										break
									}
								}
							}
						}
						if !allowed {
							errMsg, _ := json.Marshal(model.WSMessage{
								Type:    "error",
								Payload: map[string]string{"message": "workbook is private"},
							})
							c.Send <- errMsg
							return
						}
					case model.AccessModeAgents:
						// Only owner and agent system users may connect
						if wb.OwnerID != "" && payload.UserID != wb.OwnerID && !isAgentUser(payload.UserID) {
							errMsg, _ := json.Marshal(model.WSMessage{
								Type:    "error",
								Payload: map[string]string{"message": "workbook is private"},
							})
							c.Send <- errMsg
							return
						}
					}
				}
			}

			c.WorkbookID = payload.WorkbookID
			c.UserID = payload.UserID
			c.UserName = payload.UserName
			c.UserColor = payload.UserColor
			hub.register(c)

		case "update":
			hub.broadcastToWorkbook(c.WorkbookID, message, c.ID)

		case "cursor":
			hub.broadcastToWorkbook(c.WorkbookID, message, c.ID)

		case "operation":
			hub.broadcastToWorkbook(c.WorkbookID, message, c.ID)
		}
	}
}

func (c *Client) writePump() {
	defer c.Conn.Close()

	for message := range c.Send {
		if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
			break
		}
	}
}

func (h *Hub) register(client *Client) {
	h.mu.Lock()
	if _, ok := h.workbooks[client.WorkbookID]; !ok {
		h.workbooks[client.WorkbookID] = make(map[string]*Client)
	}
	h.workbooks[client.WorkbookID][client.ID] = client
	h.mu.Unlock()

	h.broadcastPresence(client.WorkbookID)
}

func (h *Hub) unregister(client *Client) {
	h.mu.Lock()
	wbID := client.WorkbookID
	if clients, ok := h.workbooks[wbID]; ok {
		delete(clients, client.ID)
		if len(clients) == 0 {
			delete(h.workbooks, wbID)
		}
	}
	delete(h.clients, client.ID)
	h.mu.Unlock()

	close(client.Send)

	if wbID != "" {
		h.broadcastPresence(wbID)
	}
}

func (h *Hub) broadcastPresence(workbookID string) {
	h.mu.RLock()
	clients := h.workbooks[workbookID]
	users := make([]map[string]string, 0, len(clients))
	for _, c := range clients {
		if c.WorkbookID == workbookID {
			users = append(users, map[string]string{
				"user_id":    c.UserID,
				"user_name":  c.UserName,
				"user_color": c.UserColor,
			})
		}
	}
	h.mu.RUnlock()

	msg, _ := json.Marshal(model.WSMessage{
		Type:    "presence",
		Payload: map[string]interface{}{"users": users},
	})
	h.broadcastToWorkbook(workbookID, msg, "")
}

func (h *Hub) broadcastToWorkbook(workbookID string, message []byte, excludeID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if clients, ok := h.workbooks[workbookID]; ok {
		for id, client := range clients {
			if id != excludeID {
				select {
				case client.Send <- message:
				default:
				}
			}
		}
	}
}

// BroadcastAll sends a message to every connected client.
func (h *Hub) BroadcastAll(message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, client := range h.clients {
		select {
		case client.Send <- message:
		default:
		}
	}
}

func jsonEncode(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// isAgentUser checks whether a user ID belongs to the agent system.
func isAgentUser(userID string) bool {
	return len(userID) >= 6 && userID[:6] == "agent-"
}
