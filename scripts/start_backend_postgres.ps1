param(
    [string]$Python = "python",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

Write-Host "Starting backend on http://127.0.0.1:$Port"
& $Python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port $Port
