package core

import (
	"strconv"

	"github.com/gmind/backend/internal/config"
)

// NewConfigProvider wraps the application config into a core.Provider.
func NewConfigProvider(cfg *config.Config) Provider {
	return &configProvider{cfg: cfg}
}

type configProvider struct {
	cfg *config.Config
}

func (p *configProvider) Get(key string) string {
	switch key {
	case "port":
		return p.cfg.Port
	case "db_path":
		return p.cfg.DBPath
	case "ai_endpoint":
		return p.cfg.AIEndpoint
	case "ai_model":
		return p.cfg.AIModel
	case "llama_config_path":
		return p.cfg.LlamaConfigPath
	case "agent_prompts_file":
		return p.cfg.AgentPromptsFile
	default:
		return ""
	}
}

func (p *configProvider) GetInt(key string, fallback int) int {
	v := p.Get(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

func (p *configProvider) GetBool(key string, fallback bool) bool {
	v := p.Get(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}
