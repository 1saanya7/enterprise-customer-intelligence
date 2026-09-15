$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $projectRoot '.local\server-pids.json'
if (-not (Test-Path -LiteralPath $pidFile)) {
    Write-Output 'No recorded project servers.'
    exit 0
}
$recorded = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
foreach ($entry in @($recorded.backend, $recorded.frontend)) {
    $connection = Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort $entry.port -ErrorAction SilentlyContinue |
        Where-Object { $_.OwningProcess -eq $entry.pid }
    if ($connection) {
        Stop-Process -Id $entry.pid
        Write-Output "Stopped project listener $($entry.pid) on port $($entry.port)"
    }
}
Remove-Item -LiteralPath $pidFile
