$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$sqlFile = Join-Path $repoRoot "scripts\grant_app_role_pagapro.sql"
if (-not (Test-Path $sqlFile)) {
  throw "Missing $sqlFile"
}

$psql = "${env:ProgramFiles}\PostgreSQL\17\bin\psql.exe"
if (-not (Test-Path $psql)) {
  $alt = Get-ChildItem "${env:ProgramFiles}\PostgreSQL" -Recurse -Filter psql.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($alt) { $psql = $alt.FullName } else { throw "psql.exe not found under Program Files\PostgreSQL" }
}

if (-not $env:POSTGRES_SUPERUSER_PASSWORD) {
  Write-Host "POSTGRES_SUPERUSER_PASSWORD not set - trying dev default 'postgres' (use a strong superuser password in production)."
  $env:PGPASSWORD = "postgres"
} else {  $env:PGPASSWORD = $env:POSTGRES_SUPERUSER_PASSWORD
}

Write-Host "Applying grants + ownership to role pagapro on database pagapro..."
& $psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -v ON_ERROR_STOP=1 -f $sqlFile

Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
Write-Host "Done."
