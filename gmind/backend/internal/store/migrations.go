package store

import (
	"fmt"
	"io/fs"
	"sort"
	"strconv"
	"strings"

	"github.com/gmind/backend/migrations"
)

type migration struct {
	version int
	name    string
	upSQL   string
	downSQL string
}

func loadMigrations() ([]migration, error) {
	entries, err := migrations.FS.ReadDir(".")
	if err != nil {
		return nil, fmt.Errorf("read migrations dir: %w", err)
	}

	type fileRef struct {
		version int
		name    string
		suffix  string
	}

	var files []fileRef
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		// pattern: 001_description.up.sql or 001_description.down.sql
		parts := strings.SplitN(name, "_", 2)
		if len(parts) < 2 {
			continue
		}
		v, err := strconv.Atoi(parts[0])
		if err != nil {
			continue
		}
		rest := strings.TrimSuffix(parts[1], ".up.sql")
		rest = strings.TrimSuffix(rest, ".down.sql")
		if rest == parts[1] {
			continue
		}
		var suffix string
		if strings.HasSuffix(parts[1], ".up.sql") {
			suffix = "up"
		} else if strings.HasSuffix(parts[1], ".down.sql") {
			suffix = "down"
		} else {
			continue
		}
		files = append(files, fileRef{version: v, name: rest, suffix: suffix})
	}

	versionMap := make(map[int]*migration)
	for _, f := range files {
		m, ok := versionMap[f.version]
		if !ok {
			m = &migration{version: f.version, name: f.name}
			versionMap[f.version] = m
		}
		filename := fmt.Sprintf("%03d_%s.%s.sql", f.version, f.name, f.suffix)
		data, err := migrations.FS.ReadFile(filename)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", filename, err)
		}
		switch f.suffix {
		case "up":
			m.upSQL = string(data)
		case "down":
			m.downSQL = string(data)
		}
	}

	result := make([]migration, 0, len(versionMap))
	for _, m := range versionMap {
		if m.upSQL == "" {
			return nil, fmt.Errorf("migration %d (%s) has no up file", m.version, m.name)
		}
		result = append(result, *m)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].version < result[j].version
	})
	return result, nil
}

func (s *Store) migrate() error {
	if err := s.ensureMigrationsTable(); err != nil {
		return fmt.Errorf("migrations table: %w", err)
	}

	applied, err := s.appliedMigrations()
	if err != nil {
		return fmt.Errorf("applied migrations: %w", err)
	}

	ms, err := loadMigrations()
	if err != nil {
		return fmt.Errorf("load migrations: %w", err)
	}

	for _, m := range ms {
		if applied[m.version] {
			continue
		}
		if err := s.applyUpMigration(m); err != nil {
			return fmt.Errorf("migration %d (%s): %w", m.version, m.name, err)
		}
	}
	return nil
}

func (s *Store) MigrateDown(version int) error {
	ms, err := loadMigrations()
	if err != nil {
		return fmt.Errorf("load migrations: %w", err)
	}

	for _, m := range ms {
		if m.version != version {
			continue
		}
		if m.downSQL == "" {
			return fmt.Errorf("migration %d has no down script", version)
		}
		return s.applyDownMigration(m)
	}
	return fmt.Errorf("migration %d not found", version)
}

func (s *Store) applyUpMigration(m migration) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(m.upSQL); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`INSERT INTO schema_migrations (version, name) VALUES (?, ?)`,
		m.version, m.name,
	); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) applyDownMigration(m migration) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(m.downSQL); err != nil {
		return err
	}

	if _, err := tx.Exec(`DELETE FROM schema_migrations WHERE version = ?`, m.version); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Store) ensureMigrationsTable() error {
	_, err := s.db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		name TEXT NOT NULL,
		applied_at TEXT NOT NULL DEFAULT (datetime('now'))
	)`)
	return err
}

func (s *Store) appliedMigrations() (map[int]bool, error) {
	rows, err := s.db.Query(`SELECT version FROM schema_migrations ORDER BY version`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[int]bool)
	for rows.Next() {
		var v int
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		applied[v] = true
	}
	return applied, rows.Err()
}

// MigrationFilesFS returns the embedded filesystem for external access.
func MigrationFilesFS() fs.FS {
	return migrations.FS
}
