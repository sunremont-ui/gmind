package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: go run tools/gen-migration/main.go <name>")
		fmt.Println("Example: go run tools/gen-migration/main.go add_topic_labels")
		os.Exit(1)
	}

	name := os.Args[1]
	re := regexp.MustCompile(`[^a-z0-9_]`)
	name = strings.ToLower(name)
	name = re.ReplaceAllString(name, "_")
	name = strings.Trim(name, "_")

	if name == "" {
		fmt.Println("Error: invalid migration name")
		os.Exit(1)
	}

	migrationsDir := filepath.Join("migrations")
	entries, err := os.ReadDir(migrationsDir)
	if err != nil {
		fmt.Printf("Error reading migrations dir: %v\n", err)
		os.Exit(1)
	}

	maxVer := 0
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		var ver int
		if _, err := fmt.Sscanf(e.Name(), "%d", &ver); err == nil && ver > maxVer {
			maxVer = ver
		}
	}

	nextVer := maxVer + 1
	upFile := filepath.Join(migrationsDir, fmt.Sprintf("%03d_%s.up.sql", nextVer, name))
	downFile := filepath.Join(migrationsDir, fmt.Sprintf("%03d_%s.down.sql", nextVer, name))

	upContent := fmt.Sprintf("-- Migration %d: %s\n-- Up\n\n", nextVer, name)
	downContent := fmt.Sprintf("-- Migration %d: %s\n-- Down\n\n", nextVer, name)

	if err := os.WriteFile(upFile, []byte(upContent), 0644); err != nil {
		fmt.Printf("Error writing %s: %v\n", upFile, err)
		os.Exit(1)
	}
	if err := os.WriteFile(downFile, []byte(downContent), 0644); err != nil {
		fmt.Printf("Error writing %s: %v\n", downFile, err)
		os.Exit(1)
	}

	fmt.Printf("Created:\n  %s\n  %s\n", upFile, downFile)
}
