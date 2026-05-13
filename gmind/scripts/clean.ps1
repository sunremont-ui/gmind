$root = Split-Path -Parent $PSScriptRoot

Write-Host "Cleaning..." -ForegroundColor Yellow

# Frontend cache
if (Test-Path "$root\frontend\node_modules\.vite") {
    Remove-Item -Recurse -Force "$root\frontend\node_modules\.vite"
    Write-Host "  Removed .vite cache" -ForegroundColor Gray
}

# Build output
if (Test-Path "$root\frontend\dist") {
    Remove-Item -Recurse -Force "$root\frontend\dist"
    Write-Host "  Removed frontend\dist" -ForegroundColor Gray
}
if (Test-Path "$root\build") {
    Remove-Item -Recurse -Force "$root\build"
    Write-Host "  Removed build\" -ForegroundColor Gray
}

Write-Host "Done." -ForegroundColor Green
