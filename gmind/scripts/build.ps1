$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Building Backend ===" -ForegroundColor Cyan
Set-Location "$root\backend"
go build -o "$root\build\server.exe" .\cmd\server
if ($LASTEXITCODE -eq 0) {
    Write-Host "Backend built: build\server.exe" -ForegroundColor Green
} else {
    Write-Host "Backend build FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Building Frontend ===" -ForegroundColor Cyan
Set-Location "$root\frontend"
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "Frontend built: frontend\dist\" -ForegroundColor Green
} else {
    Write-Host "Frontend build FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
