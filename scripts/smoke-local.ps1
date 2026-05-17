$ErrorActionPreference = "Stop"

Write-Host "Checking gateway..."
curl.exe -sf http://localhost/ | Out-Null
Write-Host "Gateway OK (HTTP 200)"

Write-Host "Note: /api/v1 and /health on api/realtime require owner services to be running."
Write-Host "Run: docker compose ps"
