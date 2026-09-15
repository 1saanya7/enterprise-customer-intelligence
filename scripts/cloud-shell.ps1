$projectRoot = Split-Path -Parent $PSScriptRoot
$toolsDir = Join-Path $projectRoot '.local\tools'
$env:PATH = (Join-Path $toolsDir 'google-cloud-sdk\bin') + ';' + (Join-Path $toolsDir 'terraform') + ';' + $env:PATH
$env:CLOUDSDK_CONFIG = Join-Path $projectRoot '.local\gcloud'
$env:CLOUDSDK_CORE_DISABLE_USAGE_REPORTING = 'true'
Write-Output 'Google Cloud and Terraform are available in this session. Cloud credentials remain local.'
