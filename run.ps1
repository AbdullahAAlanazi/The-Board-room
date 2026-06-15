# One command to launch the whole AI Board Room locally.
#   - Backend : FastAPI (live board) on http://127.0.0.1:8000
#   - Frontend: Vite dev server      on http://localhost:5173
#
# Usage (from the project root):
#   ./run.ps1
#
# Press Ctrl+C in this window to stop the backend; close the frontend window to stop it.

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host "Starting AI Board Room..." -ForegroundColor Cyan

# Backend — opens in its own window so you can see the board thinking.
$env:PYTHONPATH = "src"
$env:PYTHONUTF8 = "1"
Start-Process powershell -ArgumentList @(
  "-NoExit", "-Command",
  "cd `"$root`"; `$env:PYTHONPATH='src'; `$env:PYTHONUTF8='1'; python -m uvicorn boardroom.api:app --port 8000"
)

# Frontend — current window.
Write-Host "Backend launched on :8000. Starting frontend on :5173..." -ForegroundColor Cyan
npm --prefix "$root\frontend" run dev
