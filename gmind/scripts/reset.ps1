$root = Split-Path -Parent $PSScriptRoot

Write-Host "=== Full Reset ===" -ForegroundColor Red
Write-Host "This will delete database and all caches!" -ForegroundColor Red
$confirm = Read-Host "Are you sure? (y/N)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit
}

# Database
if (Test-Path "$root\backend\gmind.db") {
    Remove-Item -Force "$root\backend\gmind.db"
    Write-Host "  Deleted gmind.db" -ForegroundColor Gray
}

# Caches
& "$PSScriptRoot\clean.ps1"

Write-Host "Reset complete." -ForegroundColor Green
