param(
    [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $ProjectRoot

Write-Host "Installing backend dependencies from requirements.txt..."
& $Python -m pip install -r requirements.txt

Write-Host ""
Write-Host "Done."
