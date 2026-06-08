package llama

import (
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ModelInfo describes a single model file discovered under the models directory.
type ModelInfo struct {
	Path     string `json:"path"`     // relative to models dir, forward slashes
	Name     string `json:"name"`     // file name only
	Category string `json:"category"` // top-level subdir (llm, code, vision, ...) or "root"
	Size     int64  `json:"size"`     // bytes
	Running  bool   `json:"running"`
	Port     int    `json:"port"`
}

// Instance is a running llama-server process bound to one model on one port.
type Instance struct {
	cmd       *exec.Cmd
	Model     string    `json:"model"` // relative path (key)
	Port      int       `json:"port"`
	Context   int       `json:"context"`
	GPULayers int       `json:"gpu_layers"`
	Threads   int       `json:"threads"`
	StartedAt time.Time `json:"started_at"`
}

// StartRequest are the tunables for spinning up a model instance.
type StartRequest struct {
	Path      string `json:"path"` // relative model path
	Port      int    `json:"port"`
	Context   int    `json:"context"`
	GPULayers int    `json:"gpu_layers"`
	Threads   int    `json:"threads"`
}

// Manager supervises multiple concurrent llama-server processes, one per model.
type Manager struct {
	mu        sync.Mutex
	modelsDir string
	binPath   string
	instances map[string]*Instance // key = relative model path
}

func detectBin() string {
	candidates := []string{
		`E:\LlamaCpp\llama-bin\llama-server.exe`,
		`E:\LlamaCpp\llama.cpp\build\bin\Release\llama-server.exe`,
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return candidates[0]
}

// NewManager builds a manager rooted at E:\LlamaCpp\models with auto-detected binary.
func NewManager() *Manager {
	return &Manager{
		modelsDir: `E:\LlamaCpp\models`,
		binPath:   detectBin(),
		instances: make(map[string]*Instance),
	}
}

// ModelsDir returns the configured models directory.
func (m *Manager) ModelsDir() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.modelsDir
}

func isModelFile(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".gguf", ".bin", ".safetensors":
		return true
	default:
		return false
	}
}

// List walks the models directory recursively and annotates each model with
// its current running state and port.
func (m *Manager) List() []ModelInfo {
	m.mu.Lock()
	dir := m.modelsDir
	running := make(map[string]*Instance, len(m.instances))
	for k, v := range m.instances {
		running[k] = v
	}
	m.mu.Unlock()

	var models []ModelInfo
	_ = filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		if d.IsDir() || !isModelFile(d.Name()) {
			return nil
		}
		rel, relErr := filepath.Rel(dir, path)
		if relErr != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)

		category := "root"
		if parts := strings.SplitN(rel, "/", 2); len(parts) == 2 {
			category = parts[0]
		}

		var size int64
		if info, statErr := d.Info(); statErr == nil {
			size = info.Size()
		}

		mi := ModelInfo{
			Path:     rel,
			Name:     d.Name(),
			Category: category,
			Size:     size,
		}
		if inst, ok := running[rel]; ok {
			mi.Running = true
			mi.Port = inst.Port
		}
		models = append(models, mi)
		return nil
	})

	sort.Slice(models, func(i, j int) bool {
		if models[i].Category != models[j].Category {
			return models[i].Category < models[j].Category
		}
		return models[i].Name < models[j].Name
	})
	return models
}

// Running returns a snapshot of all active instances.
func (m *Manager) Running() []Instance {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Instance, 0, len(m.instances))
	for _, inst := range m.instances {
		out = append(out, *inst)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Port < out[j].Port })
	return out
}

// Start launches a llama-server for the given model on the requested port.
func (m *Manager) Start(req StartRequest) (*Instance, error) {
	if req.Path == "" {
		return nil, errors.New("model path required")
	}
	if req.Port <= 0 {
		return nil, errors.New("valid port required")
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if _, ok := m.instances[req.Path]; ok {
		return nil, fmt.Errorf("model already running: %s", req.Path)
	}
	for key, inst := range m.instances {
		if inst.Port == req.Port {
			return nil, fmt.Errorf("port %d already in use by %s", req.Port, key)
		}
	}

	if _, err := os.Stat(m.binPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("llama-server binary not found: %s", m.binPath)
	}

	fullPath := filepath.Join(m.modelsDir, filepath.FromSlash(req.Path))
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("model not found: %s", fullPath)
	}

	ctx := req.Context
	if ctx <= 0 {
		ctx = 4096
	}
	ngl := req.GPULayers
	if ngl <= 0 {
		ngl = 33
	}
	threads := req.Threads
	if threads <= 0 {
		threads = 4
	}

	args := []string{
		"-m", fullPath,
		"--host", "0.0.0.0",
		"--port", strconv.Itoa(req.Port),
		"-c", strconv.Itoa(ctx),
		"-ngl", strconv.Itoa(ngl),
		"-t", strconv.Itoa(threads),
	}

	cmd := exec.Command(m.binPath, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start llama-server: %w", err)
	}

	inst := &Instance{
		cmd:       cmd,
		Model:     req.Path,
		Port:      req.Port,
		Context:   ctx,
		GPULayers: ngl,
		Threads:   threads,
		StartedAt: time.Now(),
	}
	m.instances[req.Path] = inst

	go func(key string, c *exec.Cmd) {
		if err := c.Wait(); err != nil {
			log.Printf("llama-server[%s] exited: %v", key, err)
		}
		m.mu.Lock()
		if cur, ok := m.instances[key]; ok && cur.cmd == c {
			delete(m.instances, key)
		}
		m.mu.Unlock()
	}(req.Path, cmd)

	return inst, nil
}

// Stop terminates the instance running the given model.
func (m *Manager) Stop(path string) error {
	m.mu.Lock()
	inst, ok := m.instances[path]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("model not running: %s", path)
	}
	delete(m.instances, path)
	m.mu.Unlock()

	if inst.cmd != nil && inst.cmd.Process != nil {
		if err := inst.cmd.Process.Kill(); err != nil {
			return fmt.Errorf("stop llama-server: %w", err)
		}
	}
	return nil
}

// StopAll kills every running instance (used on graceful shutdown).
func (m *Manager) StopAll() {
	m.mu.Lock()
	insts := make([]*Instance, 0, len(m.instances))
	for _, inst := range m.instances {
		insts = append(insts, inst)
	}
	m.instances = make(map[string]*Instance)
	m.mu.Unlock()

	for _, inst := range insts {
		if inst.cmd != nil && inst.cmd.Process != nil {
			_ = inst.cmd.Process.Kill()
		}
	}
}
