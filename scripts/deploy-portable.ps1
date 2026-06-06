#!/usr/bin/env pwsh
# Deploy the freshly built portable .exe to the per-user programs folder.
#
# Windows counterpart of scripts/deploy-appimage.sh. The version is read from
# package.json so the path always matches what `pnpm build` just produced
# (electron-builder writes to release/<version>/).
$ErrorActionPreference = 'Stop'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $Root

$Version = node -p "require('./package.json').version"
$Src = Join-Path $Root "release\$Version\Abyss-$Version-x64-portable.exe"
$Dest = Join-Path $env:LOCALAPPDATA 'Programs\Abyss\Abyss.exe'

if (-not (Test-Path -LiteralPath $Src)) {
  Write-Error "Deploy failed: expected portable .exe not found: $Src`nDid the build for version $Version succeed?"
  exit 1
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Dest) | Out-Null

# Copy to a temp file, then move over the target. Note: unlike Linux (where the
# old inode lives on for a running process), Windows locks a running .exe — close
# Abyss before deploying or the move will fail.
$Tmp = "$Dest.tmp"
try {
  Copy-Item -LiteralPath $Src -Destination $Tmp -Force
  Move-Item -LiteralPath $Tmp -Destination $Dest -Force
} catch {
  Remove-Item -LiteralPath $Tmp -ErrorAction SilentlyContinue
  Write-Error "Deploy failed while replacing $Dest. Is Abyss still running? Close it and retry.`n$($_.Exception.Message)"
  exit 1
}

Write-Host "Deployed $Src -> $Dest"
