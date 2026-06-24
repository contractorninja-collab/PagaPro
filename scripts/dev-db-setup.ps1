$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Resolve-Docker {
  $bundled = "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe"
  if (Test-Path -LiteralPath $bundled) {
    return $bundled
  }
  $cmd = Get-Command docker -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source -and (Test-Path -LiteralPath $cmd.Source)) {
    return $cmd.Source
  }
  return $null
}

function Test-DockerComposePostgres {
  param([string]$DockerExe)

  Write-Host "Starting Docker Compose stack..."
  & $DockerExe compose up -d 2>&1 | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Host "docker compose up reported an error (Docker Engine may still be starting)."
    return $false
  }

  Write-Host "Waiting for Postgres health..."
  for ($i = 0; $i -lt 60; $i++) {
    & $DockerExe compose exec -T db pg_isready -U pagapro -d pagapro 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      return $true
    }
    Start-Sleep -Seconds 2
  }
  return $false
}

$docker = Resolve-Docker
$composeReady = $false

if ($docker) {
  Write-Host "Using Docker: $docker"
  & $docker compose version | Out-Host
  $composeReady = Test-DockerComposePostgres -DockerExe $docker
}

if (-not $composeReady) {
  Write-Host ""
  Write-Host "Docker Postgres is not available yet."
  Write-Host "Continuing with DATABASE_URL from .env (native PostgreSQL, cloud, or Docker once healthy)."
  Write-Host "Create the database if needed, e.g. CREATE DATABASE pagapro;"
  Write-Host ""
}

$ErrorActionPreference = "Stop"

Write-Host "Syncing schema to database (db push — migrations in repo are additive deltas for existing databases)."
npx prisma db push

Write-Host "Seeding dev company + DEV_DEFAULT_COMPANY_ID..."
npx prisma db seed

Write-Host ""
Write-Host "Done. Start the app with: npm run dev"
