$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localDir = Join-Path $projectRoot '.local'
$pidFile = Join-Path $localDir 'server-pids.json'
$apiLog = Join-Path $localDir 'api.out.log'
$apiErrorLog = Join-Path $localDir 'api.err.log'
$uiLog = Join-Path $localDir 'ui.out.log'
$uiErrorLog = Join-Path $localDir 'ui.err.log'

New-Item -ItemType Directory -Force -Path $localDir | Out-Null

function Test-Endpoint([string]$Uri) {
    try {
        $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Get-Listener([int]$Port) {
    return Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Wait-ForEndpoint([string]$Name, [string]$Uri, [System.Diagnostics.Process]$Process) {
    $deadline = (Get-Date).AddSeconds(20)
    do {
        if ($Process.HasExited) {
            throw "$Name stopped during startup with exit code $($Process.ExitCode)."
        }
        if (Test-Endpoint $Uri) {
            return
        }
        Start-Sleep -Milliseconds 250
    } until ((Get-Date) -ge $deadline)
    throw "$Name did not become ready within 20 seconds."
}

$apiReady = Test-Endpoint 'http://127.0.0.1:8000/api/health'
$uiReady = Test-Endpoint 'http://127.0.0.1:5173/login'
if ($apiReady -and $uiReady) {
    Write-Output 'Northstar is already running and both services are healthy.'
    Write-Output 'Dashboard: http://127.0.0.1:5173'
    Write-Output 'API docs: http://127.0.0.1:8000/docs'
    exit 0
}

$existingBackend = Get-Listener 8000
$existingFrontend = Get-Listener 5173
if ($existingBackend -or $existingFrontend) {
    throw 'A partial or unrelated service is using port 8000 or 5173. Run scripts\restart-local.ps1 if these are recorded Northstar processes.'
}

$pythonExe = Join-Path $projectRoot '.venv\Scripts\python.exe'
$viteEntry = Join-Path $projectRoot 'frontend\node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $pythonExe)) {
    throw 'Python environment is missing. Create .venv and install requirements before starting Northstar.'
}
if (-not (Test-Path -LiteralPath $viteEntry)) {
    throw 'Frontend dependencies are missing. Run npm.cmd ci in the frontend directory.'
}
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source

$backendProcess = $null
$frontendProcess = $null
try {
    $backendProcess = Start-Process -FilePath $pythonExe -ArgumentList @('-m','uvicorn','intelligence.api:create_app','--factory','--host','127.0.0.1','--port','8000') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $apiLog -RedirectStandardError $apiErrorLog
    Wait-ForEndpoint 'Backend' 'http://127.0.0.1:8000/api/health' $backendProcess

    $frontendProcess = Start-Process -FilePath $nodeExe -ArgumentList @(('"' + $viteEntry + '"'),'--host','127.0.0.1') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -PassThru -RedirectStandardOutput $uiLog -RedirectStandardError $uiErrorLog
    Wait-ForEndpoint 'Frontend' 'http://127.0.0.1:5173/login' $frontendProcess

    $backendListener = Get-Listener 8000
    $frontendListener = Get-Listener 5173
    if (-not $backendListener -or -not $frontendListener) {
        throw 'A service passed its HTTP check but no local listener could be identified.'
    }
    @{
        backend = @{ pid = $backendListener.OwningProcess; port = 8000 }
        frontend = @{ pid = $frontendListener.OwningProcess; port = 5173 }
    } | ConvertTo-Json | Set-Content -LiteralPath $pidFile
} catch {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -ErrorAction SilentlyContinue
    }
    if ($frontendProcess -and -not $frontendProcess.HasExited) {
        Stop-Process -Id $frontendProcess.Id -ErrorAction SilentlyContinue
    }
    Write-Error "$($_.Exception.Message) Review $apiErrorLog and $uiErrorLog."
}

Write-Output 'Backend: ready'
Write-Output 'Frontend: ready'
Write-Output 'Dashboard: http://127.0.0.1:5173'
Write-Output 'API docs: http://127.0.0.1:8000/docs'
Write-Output "Logs: $localDir"
