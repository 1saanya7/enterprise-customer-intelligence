$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot '.local\tools'
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null

# Pinned official archive; checksum from Google's versioned archive documentation.
$sdkArchive = Join-Path $toolsDir 'google-cloud-sdk-584.0.0.zip'
$sdkDir = Join-Path $toolsDir 'google-cloud-sdk'
if (-not (Test-Path -LiteralPath (Join-Path $sdkDir '.installation-complete'))) {
    Invoke-WebRequest -UseBasicParsing -Uri 'https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-sdk-584.0.0-windows-x86_64-bundled-python.zip' -OutFile $sdkArchive
    $sdkHash = (Get-FileHash -LiteralPath $sdkArchive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sdkHash -ne '69b890b635e70b45ea84cc37568dc3b652a4ed6e20a951a5f8bf4a869095e1ae') { throw 'Google Cloud archive checksum mismatch.' }
    Expand-Archive -LiteralPath $sdkArchive -DestinationPath $toolsDir -Force
    Set-Content -LiteralPath (Join-Path $sdkDir '.installation-complete') -Value '584.0.0'
}

$terraformVersion = '1.16.2'
$terraformFile = "terraform_${terraformVersion}_windows_amd64.zip"
$terraformArchive = Join-Path $toolsDir $terraformFile
$terraformDir = Join-Path $toolsDir 'terraform'
if (-not (Test-Path -LiteralPath (Join-Path $terraformDir '.installation-complete'))) {
    $releaseBase = "https://releases.hashicorp.com/terraform/$terraformVersion"
    Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/$terraformFile" -OutFile $terraformArchive
    $checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/terraform_${terraformVersion}_SHA256SUMS").Content
    $expectedLine = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith($terraformFile) })
    if (-not $expectedLine) { throw 'Terraform checksum entry missing.' }
    $expectedHash = ($expectedLine.Trim() -split '\s+')[0]
    if ((Get-FileHash -LiteralPath $terraformArchive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Terraform archive checksum mismatch.' }
    Expand-Archive -LiteralPath $terraformArchive -DestinationPath $terraformDir -Force
    Set-Content -LiteralPath (Join-Path $terraformDir '.installation-complete') -Value $terraformVersion
}
Write-Output "Installed cloud tools in $toolsDir"
Write-Output 'Run ./scripts/cloud-shell.ps1 to make them available in this PowerShell session.'
