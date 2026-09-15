# Official release mirror fallback when registry.terraform.io DNS is unavailable.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path -Parent $PSScriptRoot
$providerVersion = '7.46.1'
$providerFilename = "terraform-provider-google_${providerVersion}_windows_amd64.zip"
$mirrorRoot = Join-Path $projectRoot '.local\terraform-mirror'
$providerDir = Join-Path $mirrorRoot "registry.terraform.io\hashicorp\google\$providerVersion\windows_amd64"
New-Item -ItemType Directory -Force -Path $providerDir | Out-Null
$archive = Join-Path $projectRoot ".local\tools\$providerFilename"
$releaseBase = "https://releases.hashicorp.com/terraform-provider-google/$providerVersion"
Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/$providerFilename" -OutFile $archive
$checksums = (Invoke-WebRequest -UseBasicParsing -Uri "$releaseBase/terraform-provider-google_${providerVersion}_SHA256SUMS").Content
$expectedLine = ($checksums -split "`n" | Where-Object { $_.Trim().EndsWith($providerFilename) })
if (-not $expectedLine) { throw 'Provider checksum entry missing.' }
$expectedHash = ($expectedLine.Trim() -split '\s+')[0]
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Provider archive checksum mismatch.' }
Expand-Archive -LiteralPath $archive -DestinationPath $providerDir -Force
$terraformExe = Join-Path $projectRoot '.local\tools\terraform\terraform.exe'
& $terraformExe "-chdir=$projectRoot\infrastructure" init -backend=false "-plugin-dir=$mirrorRoot"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $terraformExe "-chdir=$projectRoot\infrastructure" validate
exit $LASTEXITCODE
