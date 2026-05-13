package agent

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"sync"
)

// PromptConfig holds the system and role prompts for agents.
type PromptConfig struct {
	System string            `json:"system"`
	Roles  map[string]string `json:"roles"`
}

//go:embed prompts.json
var defaultPromptsJSON []byte

// PromptStore loads and caches agent prompts from a JSON config file.
type PromptStore struct {
	mu       sync.RWMutex
	config   PromptConfig
	filePath string
}

func NewPromptStore(filePath string) *PromptStore {
	ps := &PromptStore{filePath: filePath}
	ps.load()
	return ps
}

func (ps *PromptStore) load() {
	ps.config = defaultConfig()

	if ps.filePath == "" {
		return
	}

	data, err := os.ReadFile(ps.filePath)
	if err != nil {
		// File not found — use defaults silently
		return
	}

	var cfg PromptConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		// Invalid JSON — use defaults
		return
	}

	if cfg.System != "" {
		ps.config.System = cfg.System
	}
	for role, prompt := range cfg.Roles {
		if prompt != "" {
			ps.config.Roles[role] = prompt
		}
	}
}

// Reload re-reads the config file.
func (ps *PromptStore) Reload() {
	ps.mu.Lock()
	defer ps.mu.Unlock()
	ps.load()
}

// System returns the system prompt.
func (ps *PromptStore) System() string {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.config.System
}

// Role returns the role-specific prompt, falling back to the role name as a label.
func (ps *PromptStore) Role(role string) string {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	if p, ok := ps.config.Roles[role]; ok {
		return p
	}
	return fmt.Sprintf("You are a %s agent. Use the available tools to accomplish your task.", role)
}

func defaultConfig() PromptConfig {
	var cfg PromptConfig
	if len(defaultPromptsJSON) > 0 {
		json.Unmarshal(defaultPromptsJSON, &cfg)
	}
	if cfg.System == "" {
		cfg.System = "You are an agent in a mind mapping application called Gmind. You have access to tools that let you view and modify the mind map. Before calling a tool, validate your reasoning. Call at most one tool per response. When you have completed your task, respond with a final message summarizing what was done."
	}
	if cfg.Roles == nil {
		cfg.Roles = make(map[string]string)
	}
	if cfg.Roles["researcher"] == "" {
		cfg.Roles["researcher"] = "You are a Researcher agent. Your role is to gather information from the mind map and the web. Use search_web to find relevant information, get_workbook to understand the structure, and get_topic to dive deep. Present your findings clearly. Do NOT create or modify topics."
	}
	if cfg.Roles["organizer"] == "" {
		cfg.Roles["organizer"] = "You are an Organizer agent. Your role is to restructure and organize the mind map. Use create_topic, update_topic, and create_multiple_topics to improve the structure. You can suggest new groupings and reorganize content for clarity."
	}
	if cfg.Roles["critic"] == "" {
		cfg.Roles["critic"] = "You are a Critic agent. Your role is to analyze the mind map and provide constructive feedback. Use get_workbook to examine the structure, then provide analysis and suggestions. Do NOT modify the mind map directly."
	}
	if cfg.Roles["expander"] == "" {
		cfg.Roles["expander"] = "You are an Expander agent. Your role is to expand topics by adding new sub-topics. Use create_multiple_topics to add 3-5 new children to a parent topic. Use get_topic first to see existing children and avoid duplicates."
	}
	if cfg.Roles["summarizer"] == "" {
		cfg.Roles["summarizer"] = "You are a Summarizer agent. Your role is to summarize branches of the mind map. Use get_topic to read a branch and summarize_topics to produce concise bullet-point summaries."
	}
	if cfg.Roles["editor"] == "" {
		cfg.Roles["editor"] = "You are an Editor agent. Your role is to improve topic titles, add notes, and clean up the mind map. Use update_topic and add_note to refine content. Use get_workbook to find topics needing editing."
	}
	if cfg.Roles["analyst"] == "" {
		cfg.Roles["analyst"] = "You are an Analyst agent. Your role is to analyze mind map structure and content. Use get_workbook and get_topic to examine the map, then provide data-driven insights. You may also use search_web for additional context. Do NOT modify the map."
	}
	return cfg
}
