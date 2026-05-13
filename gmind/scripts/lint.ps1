$root = Split-Path -Parent $PSScriptRoot
$exitCode = 0

Write-Host "=== Linting Backend ===" -ForegroundColor Cyan
Set-Location "$root\backend"

# golangci-lint
$golangci = "$(go env GOPATH)\bin\golangci-lint.exe"
if (Test-Path $golangci) {
    & $golangci run ./...
    if ($LASTEXITCODE -ne 0) {
        Write-Host "golangci-lint FAILED" -ForegroundColor Red
        $exitCode = 1
    } else {
        Write-Host "golangci-lint: OK" -ForegroundColor Green
    }
} else {
    Write-Host "golangci-lint not installed, falling back to go vet" -ForegroundColor Yellow
    go vet ./...
    if ($LASTEXITCODE -ne 0) {
        Write-Host "go vet FAILED" -ForegroundColor Red
        $exitCode = 1
    } else {
        Write-Host "go vet: OK" -ForegroundColor Green
    }
}

Write-Host "`n=== Linting Frontend ===" -ForegroundColor Cyan
Set-Location "$root\frontend"
if (Test-Path "$root\frontend\node_modules\.bin\eslint") {
    npm run lint
    if ($LASTEXITCODE -ne 0) {
        Write-Host "eslint FAILED" -ForegroundColor Red
        $exitCode = 1
    } else {
        Write-Host "eslint: OK" -ForegroundColor Green
    }
} else {
    Write-Host "eslint not configured, skipping" -ForegroundColor Yellow
}

# TypeScript check
if (Test-Path "$root\frontend\node_modules\.bin\tsc") {
    npx tsc --noEmit
    if ($LASTEXITCODE -ne 0) {
        Write-Host "tsc FAILED" -ForegroundColor Red
        $exitCode = 1
    } else {
        Write-Host "tsc: OK" -ForegroundColor Green
    }
} else {
    Write-Host "tsc not configured, skipping" -ForegroundColor Yellow
}

exit $exitCode
