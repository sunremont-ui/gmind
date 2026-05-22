package llama

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
)

type Config struct {
	ServerPath string `json:"server_path"`
	ModelPath  string `json:"model_path"`
	Port       int    `json:"port"`
	Context    int    `json:"context"`
	GPULayers  int    `json:"gpu_layers"`
	Threads    int    `json:"threads"`
}

type Server struct {
	mu      sync.Mutex
	cmd     *exec.Cmd
	config  Config
	running bool
}

func New() *Server {
	return &Server{
		config: Config{
			ServerPath: `E:\LlamaCpp\llama.cpp\build\bin\Release\llama-server.exe`,
			ModelPath:  `E:\LlamaCpp\models\qwen2.5-coder-7b-instruct-q4_k_m.gguf`,
			Port:       1100,
			Context:    4096,
			GPULayers:  33,
			Threads:    4,
		},
	}
}

func (s *Server) Config() Config {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.config
}

func (s *Server) UpdateConfig(cfg Config) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = cfg
}

func (s *Server) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return errors.New("server already running")
	}

	if _, err := os.Stat(s.config.ServerPath); os.IsNotExist(err) {
		return fmt.Errorf("server binary not found: %s", s.config.ServerPath)
	}
	if _, err := os.Stat(s.config.ModelPath); os.IsNotExist(err) {
		return fmt.Errorf("model not found: %s", s.config.ModelPath)
	}

	args := []string{
		"-m", s.config.ModelPath,
		"--host", "0.0.0.0",
		"--port", strconv.Itoa(s.config.Port),
		"-c", strconv.Itoa(s.config.Context),
		"-ngl", strconv.Itoa(s.config.GPULayers),
		"-t", strconv.Itoa(s.config.Threads),
	}

	s.cmd = exec.Command(s.config.ServerPath, args...)
	s.cmd.Stdout = os.Stdout
	s.cmd.Stderr = os.Stderr

	if err := s.cmd.Start(); err != nil {
		return fmt.Errorf("start server: %w", err)
	}

	go func() {
		if err := s.cmd.Wait(); err != nil {
			log.Printf("llama server exited: %v", err)
		}
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	s.running = true
	return nil
}

func (s *Server) Stop() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running || s.cmd == nil {
		return errors.New("server not running")
	}

	if err := s.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("stop server: %w", err)
	}

	s.running = false
	s.cmd = nil
	return nil
}

func (s *Server) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

func isLlamaModelFile(name string) bool {
	ext := strings.ToLower(filepath.Ext(name))
	switch ext {
	case ".gguf", ".bin", ".pt", ".safetensors":
		return true
	default:
		return false
	}
}

func (s *Server) AvailableModels() []string {
	s.mu.Lock()
	cfg := s.config
	s.mu.Unlock()

	modelPath := cfg.ModelPath
	if modelPath == "" {
		return nil
	}

	fileInfo, err := os.Stat(modelPath)
	if err != nil {
		return nil
	}

	dir := modelPath
	if !fileInfo.IsDir() {
		dir = filepath.Dir(modelPath)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	models := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if isLlamaModelFile(name) {
			models = append(models, name)
		}
	}

	sort.Strings(models)
	if len(models) == 0 && !fileInfo.IsDir() {
		models = append(models, filepath.Base(modelPath))
	}
	return models
}

func (s *Server) SaveConfig(path string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func (s *Server) LoadConfig(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.config = cfg
	return nil
}
