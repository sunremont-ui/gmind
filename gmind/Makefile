.PHONY: dev dev-back dev-front run build clean reset lint test

# Start both dev servers via PowerShell
dev:
	powershell -ExecutionPolicy Bypass -File scripts/start.ps1

# SIMPLEST: double-click run.bat or:
run:
	cd backend && start go run ./cmd/server & cd frontend && start npm run dev

# Start only backend
dev-back:
	cd backend && go run ./cmd/server

# Start only frontend
dev-front:
	cd frontend && npm run dev

# Build both
build:
	powershell -ExecutionPolicy Bypass -File scripts/build.ps1

# Clean caches
clean:
	powershell -ExecutionPolicy Bypass -File scripts/clean.ps1

# Full reset (DB + caches)
reset:
	powershell -ExecutionPolicy Bypass -File scripts/reset.ps1

# Lint both
lint:
	powershell -ExecutionPolicy Bypass -File scripts/lint.ps1

# Run backend tests
test:
	cd backend && go test ./... -v

# Tauri desktop (requires sidecar binary first)
tauri-sidecar:
	powershell -ExecutionPolicy Bypass -File scripts/build-sidecar.bat

tauri-dev: tauri-sidecar
	cd frontend && cargo tauri dev

tauri-build: tauri-sidecar
	cd frontend && cargo tauri build

# Release: build sidecar + tauri .msi
release: tauri-sidecar
	cd frontend && cargo tauri build --target x86_64-pc-windows-msvc

# Generate TypeScript types from Go model types
gen-types:
	cd backend && go run tools/gen-ts-types/main.go

# Create a new database migration
gen-migration:
	cd backend && go run tools/gen-migration/main.go "$(name)"


