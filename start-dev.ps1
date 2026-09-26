$env:PATH = "C:\Program Files\nodejs;$env:APPDATA\npm;$env:PATH"
Write-Host "Iniciando servidor de desarrollo en http://localhost:3000..." -ForegroundColor Cyan
pnpm dev
