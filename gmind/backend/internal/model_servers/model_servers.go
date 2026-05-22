package model_servers

import (
	"encoding/json"
	"os"
)

type Server struct {
	Name     string `json:"name"`
	Endpoint string `json:"endpoint"`
	Type     string `json:"type"` // "openai" | "ollama" | "llama"
	Port     int    `json:"port"`
}

type Config struct {
	Servers []Server `json:"servers"`
}

func Default() *Config {
	return &Config{
		Servers: []Server{
			{Name: "llama.cpp", Endpoint: "http://localhost:1100/v1", Type: "openai", Port: 1100},
			{Name: "LM Studio", Endpoint: "http://localhost:1234/v1", Type: "openai", Port: 1234},
			{Name: "Jan", Endpoint: "http://localhost:1337/v1", Type: "openai", Port: 1337},
		},
	}
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return Default(), nil
	}
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func Save(path string, cfg *Config) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
