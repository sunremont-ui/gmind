package config

import (
	"os"
	"strings"
)

type Config struct {
	Port             string
	DBPath           string
	AIEndpoint       string
	AIModel          string
	AIAPIKey         string
	AllowedOrigins   []string
	LlamaConfigPath  string
	AgentPromptsFile string
	YandexAPIKey     string
	YandexFolderID   string
	YandexModel      string
	WikiPath         string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./gmind.db"
	}

	aiEndpoint := os.Getenv("AI_ENDPOINT")
	if aiEndpoint == "" {
		aiEndpoint = "https://api.openai.com/v1"
	}

	aiModel := os.Getenv("AI_MODEL")
	if aiModel == "" {
		aiModel = "gpt-4o"
	}

	llamaCfg := os.Getenv("LLAMA_CONFIG")
	if llamaCfg == "" {
		llamaCfg = "./llama-config.json"
	}

	agentPromptsFile := os.Getenv("AGENT_PROMPTS_FILE")
	if agentPromptsFile == "" {
		agentPromptsFile = ""
	}

	yandexModel := os.Getenv("YANDEX_MODEL")
	if yandexModel == "" {
		yandexModel = "yandexgpt"
	}

	wikiPath := os.Getenv("WIKI_PATH")
	if wikiPath == "" {
		wikiPath = "./wiki"
	}

	corsOrigins := os.Getenv("CORS_ORIGINS")
	var allowedOrigins []string
	if corsOrigins != "" {
		allowedOrigins = strings.Split(corsOrigins, ",")
		for i := range allowedOrigins {
			allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
		}
	} else {
		allowedOrigins = []string{"http://localhost:5173", "http://localhost:3000"}
	}

	return &Config{
		Port:             port,
		DBPath:           dbPath,
		AIEndpoint:       aiEndpoint,
		AIModel:          aiModel,
		AIAPIKey:         os.Getenv("AI_API_KEY"),
		AllowedOrigins:   allowedOrigins,
		LlamaConfigPath:  llamaCfg,
		AgentPromptsFile: agentPromptsFile,
		YandexAPIKey:     os.Getenv("YANDEX_API_KEY"),
		YandexFolderID:   os.Getenv("YANDEX_FOLDER_ID"),
		YandexModel:      yandexModel,
		WikiPath:         wikiPath,
	}
}
