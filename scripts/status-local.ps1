$ErrorActionPreference = 'Stop'

function Test-Endpoint([string]$Uri) {
    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

$apiReady = Test-Endpoint 'http://127.0.0.1:8000/api/health'
$uiReady = Test-Endpoint 'http://127.0.0.1:5173/login'

Write-Output "Backend: $(if ($apiReady) { 'ready' } else { 'unavailable' })"
Write-Output "Frontend: $(if ($uiReady) { 'ready' } else { 'unavailable' })"

if (-not $apiReady -or -not $uiReady) {
    Write-Output 'Recovery: powershell.exe -ExecutionPolicy Bypass -File scripts\restart-local.ps1'
    exit 1
}
