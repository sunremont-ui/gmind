package config

import (
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	Port                   string
	DBPath                 string
	AIEndpoint             string
	AIModel                string
	AIAPIKey               string
	AllowedOrigins         []string
	LlamaConfigPath        string
	AgentPromptsFile       string
	YandexAPIKey           string
	YandexFolderID         string
	YandexModel            string
	WikiPath               string
	MASysBaseURL           string
	ModelServersConfigPath string
}

func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "1010"
	}

	// GMIND_DATA_DIR is set by Tauri to app_data_dir; fallback to os.UserConfigDir()/Gmind
	dataDir := os.Getenv("GMIND_DATA_DIR")
	if dataDir == "" {
		if cfgDir, err := os.UserConfigDir(); err == nil {
			dataDir = filepath.Join(cfgDir, "Gmind")
		} else {
			dataDir = "."
		}
	}
	if err := os.MkdirAll(dataDir, 0o755); err == nil {
		// ensure data dir exists
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = filepath.Join(dataDir, "gmind.db")
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
		llamaCfg = filepath.Join(dataDir, "llama-config.json")
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
		wikiPath = filepath.Join(dataDir, "wiki")
	}

	maSysBaseURL := os.Getenv("MASYS_BASE_URL")
	if maSysBaseURL == "" {
		maSysBaseURL = "http://localhost:3001"
	}

	modelServersCfg := os.Getenv("MODEL_SERVERS_CONFIG")
	if modelServersCfg == "" {
		modelServersCfg = filepath.Join(dataDir, "model-servers.json")
	}

	corsOrigins := os.Getenv("CORS_ORIGINS")
	var allowedOrigins []string
	if corsOrigins != "" {
		allowedOrigins = strings.Split(corsOrigins, ",")
		for i := range allowedOrigins {
			allowedOrigins[i] = strings.TrimSpace(allowedOrigins[i])
		}
	} else {
		allowedOrigins = []string{"http://localhost:1011", "http://localhost:1012", "http://localhost:3000", "tauri://localhost", "https://tauri.localhost"}
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
		WikiPath:               wikiPath,
		MASysBaseURL:           maSysBaseURL,
		ModelServersConfigPath: modelServersCfg,
	}
}
