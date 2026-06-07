$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Test-HttpOk {
    param([string]$Label, [string]$Url)
    curl.exe -sf $Url | Out-Null
    Write-Host "$Label OK"
}

Write-Host "Smoke test (local stack)..."

Test-HttpOk "Gateway" "http://localhost/"

Write-Host "API /health (in-container)..."
docker compose exec -T api-service wget -qO- http://127.0.0.1:3000/health | Out-Null
Write-Host "API health OK"

Write-Host "API /ready (in-container)..."
docker compose exec -T api-service wget -qO- http://127.0.0.1:3000/ready | Out-Null
Write-Host "API ready OK"

Write-Host "Realtime /health (in-container)..."
docker compose exec -T realtime-service wget -qO- http://127.0.0.1:4000/health | Out-Null
Write-Host "Realtime health OK"

Write-Host "Realtime /ready (in-container)..."
docker compose exec -T realtime-service wget -qO- http://127.0.0.1:4000/ready | Out-Null
Write-Host "Realtime ready OK"

Write-Host "All smoke checks passed."
