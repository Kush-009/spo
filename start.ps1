$ErrorActionPreference = "Stop"
Clear-Host
Write-Host "===============================================================" -ForegroundColor Green
Write-Host "     SPOTIFY TABLET STREAM DECK LAUNCHER" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Green
Write-Host ""

$pythonPath = "C:\Users\Reyansh\AppData\Local\Python\pythoncore-3.14-64\python.exe"
if (-not (Test-Path $pythonPath)) {
    $cmd = Get-Command python, py -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd) {
        $pythonPath = $cmd.Source
    } else {
        Write-Host "[ERROR] Python was not found on your system." -ForegroundColor Red
        Write-Host "Please install Python from https://www.python.org"
        pause
        exit 1
    }
}

$localIp = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Ethernet -ErrorAction SilentlyContinue).IPAddress
if (-not $localIp) {
    $localIp = "192.168.31.197"
}

Write-Host "[OK] Using Python: $pythonPath" -ForegroundColor Green
Write-Host ""
Write-Host "---------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "  * PC Browser URL:      http://localhost:5000" -ForegroundColor White
Write-Host "  * Tablet Browser URL:  http://${localIp}:5000" -ForegroundColor Yellow
Write-Host "---------------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting server... (Press Ctrl+C to stop)" -ForegroundColor Cyan
Write-Host ""

Start-Process "http://localhost:5000"
& $pythonPath "$PSScriptRoot\server.py"
