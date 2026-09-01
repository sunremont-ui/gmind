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
	// MarkdownPath — каталог Markdown-хранилища: сюда по умолчанию
	// сохраняются карты как .md и отсюда же открываются файлы.
	MarkdownPath string
	// MASysConfigPath — файл с выбранным адресом MASys: адрес, заданный
	// пользователем в UI, переживает перезапуск.
	MASysConfigPath string
	// LabRegistryPath — файл со списком каталогов проектов, у которых есть трек
	// лабы. Хранятся только пути: трек и namespace живут в lab.config.json
	// самого проекта и второй копии в настройках Gmind иметь не должны.
	LabRegistryPath string
	// FilesPath — локальное хранилище вложений, пришедших из внешних систем.
	// Карта должна открываться сама по себе, поэтому байты лежат рядом с Gmind,
	// а не отдаются чужим сервером, который может быть выключен.
	FilesPath string
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

	markdownPath := os.Getenv("MARKDOWN_PATH")
	if markdownPath == "" {
		markdownPath = filepath.Join(dataDir, "markdown")
	}

	filesPath := os.Getenv("FILES_PATH")
	if filesPath == "" {
		filesPath = filepath.Join(dataDir, "files")
	}

	// MASys backend слушает :5010 (web — :5020, супервизор — :5030).
	maSysBaseURL := os.Getenv("MASYS_BASE_URL")
	if maSysBaseURL == "" {
		maSysBaseURL = "http://localhost:5010"
	}
	maSysCfgPath := os.Getenv("MASYS_CONFIG")
	if maSysCfgPath == "" {
		maSysCfgPath = filepath.Join(dataDir, "masys.json")
	}

	labRegistryPath := os.Getenv("LAB_REGISTRY")
	if labRegistryPath == "" {
		labRegistryPath = filepath.Join(dataDir, "lab-projects.json")
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
		// tauri://localhost (macOS/Linux) + http/https tauri.localhost (Windows WebView2).
		allowedOrigins = []string{"http://localhost:1011", "http://localhost:1012", "http://localhost:3000", "tauri://localhost", "http://tauri.localhost", "https://tauri.localhost"}
	}

	return &Config{
		Port:                   port,
		DBPath:                 dbPath,
		AIEndpoint:             aiEndpoint,
		AIModel:                aiModel,
		AIAPIKey:               os.Getenv("AI_API_KEY"),
		AllowedOrigins:         allowedOrigins,
		LlamaConfigPath:        llamaCfg,
		AgentPromptsFile:       agentPromptsFile,
		YandexAPIKey:           os.Getenv("YANDEX_API_KEY"),
		YandexFolderID:         os.Getenv("YANDEX_FOLDER_ID"),
		YandexModel:            yandexModel,
		WikiPath:               wikiPath,
		MASysBaseURL:           maSysBaseURL,
		ModelServersConfigPath: modelServersCfg,
		MarkdownPath:           markdownPath,
		MASysConfigPath:        maSysCfgPath,
		LabRegistryPath:        labRegistryPath,
		FilesPath:              filesPath,
	}
}
