package store

import (
	"database/sql"
	"fmt"
	"time"
)

// AgentRecord represents a persisted agent definition.
type AgentRecord struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Role         string `json:"role"`
	Provider     string `json:"provider"`
	Model        string `json:"model"`
	SystemPrompt string `json:"system_prompt"`
	CreatedAt    string `json:"created_at"`
}

// AgentStore provides SQLite persistence for agent definitions.
type AgentStore struct {
	db *sql.DB
}

func NewAgentStore(db *sql.DB) *AgentStore {
	return &AgentStore{db: db}
}

const agentCols = `id, name, role, provider, model, system_prompt, created_at`

func (as *AgentStore) scan(row interface{ Scan(dest ...any) error }) (*AgentRecord, error) {
	a := &AgentRecord{}
	err := row.Scan(&a.ID, &a.Name, &a.Role, &a.Provider, &a.Model, &a.SystemPrompt, &a.CreatedAt)
	return a, err
}

func (as *AgentStore) Insert(a *AgentRecord) error {
	if a.CreatedAt == "" {
		a.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	_, err := as.db.Exec(
		`INSERT INTO agents (`+agentCols+`) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.Name, a.Role, a.Provider, a.Model, a.SystemPrompt, a.CreatedAt,
	)
	return err
}

func (as *AgentStore) Get(id string) (*AgentRecord, error) {
	a, err := as.scan(as.db.QueryRow(`SELECT `+agentCols+` FROM agents WHERE id = ?`, id))
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("agent %s not found", id)
	}
	return a, err
}

func (as *AgentStore) List() ([]*AgentRecord, error) {
	rows, err := as.db.Query(`SELECT ` + agentCols + ` FROM agents ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []*AgentRecord
	for rows.Next() {
		a, err := as.scan(rows)
		if err != nil {
			return nil, err
		}
		agents = append(agents, a)
	}
	return agents, nil
}

func (as *AgentStore) Update(a *AgentRecord) error {
	_, err := as.db.Exec(
		`UPDATE agents SET name = ?, role = ?, provider = ?, model = ?, system_prompt = ? WHERE id = ?`,
		a.Name, a.Role, a.Provider, a.Model, a.SystemPrompt, a.ID,
	)
	return err
}

func (as *AgentStore) Delete(id string) error {
	_, err := as.db.Exec(`DELETE FROM agents WHERE id = ?`, id)
	return err
}
