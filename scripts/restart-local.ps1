$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot 'stop-local.ps1')
& (Join-Path $PSScriptRoot 'start-local.ps1')

Write-Output 'Northstar restarted successfully.'
