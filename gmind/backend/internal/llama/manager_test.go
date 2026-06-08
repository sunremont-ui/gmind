package llama

import (
	"os"
	"path/filepath"
	"testing"
)

func TestIsModelFile(t *testing.T) {
	cases := map[string]bool{
		"model.gguf":       true,
		"model.GGUF":       true,
		"weights.bin":      true,
		"net.safetensors":  true,
		"readme.md":        false,
		"config.json":      false,
		"noext":            false,
		"archive.gguf.zip": false,
	}
	for name, want := range cases {
		if got := isModelFile(name); got != want {
			t.Errorf("isModelFile(%q) = %v, want %v", name, got, want)
		}
	}
}

// newTestManager points a Manager at a temp models dir seeded with fake files.
func newTestManager(t *testing.T) *Manager {
	t.Helper()
	dir := t.TempDir()
	// category subdirs + root-level model
	files := []string{
		filepath.Join("llm", "qwen.gguf"),
		filepath.Join("llm", "llama.gguf"),
		filepath.Join("code", "coder.gguf"),
		"root-model.gguf",
		filepath.Join("llm", "notes.txt"), // ignored (not a model)
	}
	for _, f := range files {
		full := filepath.Join(dir, f)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return &Manager{
		modelsDir: dir,
		binPath:   filepath.Join(dir, "does-not-exist-llama-server"),
		instances: make(map[string]*Instance),
	}
}

func TestListScansAndCategorizes(t *testing.T) {
	m := newTestManager(t)
	models := m.List()

	if len(models) != 4 {
		t.Fatalf("expected 4 model files, got %d: %+v", len(models), models)
	}

	// .txt must be skipped.
	for _, mi := range models {
		if mi.Name == "notes.txt" {
			t.Errorf("non-model file leaked into list: %+v", mi)
		}
	}

	// Category = top-level subdir, or "root" for files in the models dir.
	wantCat := map[string]string{
		"qwen.gguf":       "llm",
		"llama.gguf":      "llm",
		"coder.gguf":      "code",
		"root-model.gguf": "root",
	}
	for _, mi := range models {
		if wantCat[mi.Name] != mi.Category {
			t.Errorf("%s: category = %q, want %q", mi.Name, mi.Category, wantCat[mi.Name])
		}
		if mi.Running {
			t.Errorf("%s should not be running", mi.Name)
		}
		if mi.Path == "" || filepath.IsAbs(mi.Path) {
			t.Errorf("%s: path should be relative+forward-slashed, got %q", mi.Name, mi.Path)
		}
	}

	// Sorted by category then name.
	if models[0].Category > models[len(models)-1].Category {
		t.Errorf("models not sorted by category: %+v", models)
	}
}

func TestStartValidation(t *testing.T) {
	m := newTestManager(t)

	if _, err := m.Start(StartRequest{Path: "", Port: 8080}); err == nil {
		t.Error("expected error for empty path")
	}
	if _, err := m.Start(StartRequest{Path: "llm/qwen.gguf", Port: 0}); err == nil {
		t.Error("expected error for invalid port")
	}
	// Binary missing → error (and nothing registered).
	if _, err := m.Start(StartRequest{Path: "llm/qwen.gguf", Port: 8080}); err == nil {
		t.Error("expected error for missing binary")
	}
	if len(m.Running()) != 0 {
		t.Errorf("no instance should be registered after failed start, got %d", len(m.Running()))
	}
}

func TestStartPortAndModelCollision(t *testing.T) {
	m := newTestManager(t)
	// Inject a fake running instance to exercise the collision guards without
	// spawning a real process.
	m.instances["llm/qwen.gguf"] = &Instance{Model: "llm/qwen.gguf", Port: 9001}

	if _, err := m.Start(StartRequest{Path: "llm/qwen.gguf", Port: 9002}); err == nil {
		t.Error("expected error: model already running")
	}
	if _, err := m.Start(StartRequest{Path: "code/coder.gguf", Port: 9001}); err == nil {
		t.Error("expected error: port already in use")
	}

	// List should mark the injected model as running on its port.
	for _, mi := range m.List() {
		if mi.Path == "llm/qwen.gguf" {
			if !mi.Running || mi.Port != 9001 {
				t.Errorf("running model not annotated: %+v", mi)
			}
		}
	}
}

func TestStopNotRunning(t *testing.T) {
	m := newTestManager(t)
	if err := m.Stop("llm/qwen.gguf"); err == nil {
		t.Error("expected error stopping a model that is not running")
	}
}
