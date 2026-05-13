$root = Split-Path -Parent $PSScriptRoot

Write-Host "═════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Gmind — starting dev servers..." -ForegroundColor Cyan
Write-Host "═════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Start backend
Write-Host "[Backend] Starting on http://localhost:8080 ..." -ForegroundColor Green
$backJob = Start-Process -PassThru -NoNewWindow -FilePath "go" -ArgumentList "run", "./cmd/server" -WorkingDirectory "$root\backend"

# Start frontend
Write-Host "[Frontend] Starting on http://localhost:5173 ..." -ForegroundColor Green
$frontProcess = Start-Process -PassThru -NoNewWindow -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "$root\frontend"

Write-Host ""
Write-Host "═════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:8080" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host "═════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

# Wait for either process to exit
try {
    $backJob.WaitForExit()
} catch {
    Write-Host "Stopped." -ForegroundColor Yellow
} finally {
    if (-not $backJob.HasExited) { $backJob.Kill() }
}
