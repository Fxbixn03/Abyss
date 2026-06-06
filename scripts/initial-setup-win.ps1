<#
.SYNOPSIS
    Abyss dev setup for Windows — clones the repo, installs prerequisites and launches the app.

.DESCRIPTION
    Checks and installs (if necessary) git, Node.js >= 20 and pnpm.
    Clones the Abyss repository or updates it via git pull.
    Then runs pnpm install and the chosen action (dev or build).

.PARAMETER TargetDir
    Directory to clone the repo into.
    Default: $HOME\Projects\Abyss

.PARAMETER Action
    Action to run after setup: 'dev' (default) or 'build'.

.PARAMETER LogPath
    Path to the log file.
    Default: $PSScriptRoot\logs\<date>_setup-abyss.log

.EXAMPLE
    .\setup-abyss.ps1
    Clones/updates Abyss and starts pnpm dev.

.EXAMPLE
    .\setup-abyss.ps1 -Action build
    Clones/updates Abyss and creates a production build.

.EXAMPLE
    .\setup-abyss.ps1 -TargetDir "C:\Dev\Abyss" -Action dev
    Clones into a custom directory and starts dev mode.

.NOTES
    Author:  FS
    Version: 1.0
    Requires: PowerShell 5.1+ or pwsh 7+
    winget must be available for automatic installation (Windows 10 1809+).
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter()]
    [string]$TargetDir = "$HOME\Projects\Abyss",

    [Parameter()]
    [ValidateSet('dev', 'build')]
    [string]$Action = 'dev',

    [Parameter()]
    [string]$LogPath = "$PSScriptRoot\logs\$(Get-Date -Format 'yyyy-MM-dd')_setup-abyss.log"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoUrl           = 'https://github.com/Fxbixn03/Abyss.git'
$RequiredNodeMajor = 20

#region --- Logging ---

function Write-Log {
    param(
        [Parameter(Mandatory)]
        [string]$Message,

        [ValidateSet('INFO', 'WARN', 'ERROR', 'DEBUG')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $entry     = "[$timestamp] [$Level] $Message"

    $color = switch ($Level) {
        'WARN'  { 'Yellow' }
        'ERROR' { 'Red' }
        'DEBUG' { 'Gray' }
        default { 'Cyan' }
    }
    Write-Host $entry -ForegroundColor $color

    if ($LogPath) {
        $logDir = Split-Path $LogPath
        if ($logDir -and -not (Test-Path $logDir)) {
            New-Item -ItemType Directory -Path $logDir -Force | Out-Null
        }
        Add-Content -Path $LogPath -Value $entry -Encoding UTF8
    }
}

#endregion

#region --- Helper Functions ---

function Invoke-RefreshPath {
    # Reload PATH from registry without restarting the shell
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath    = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path    = "$machinePath;$userPath"
}

function Test-CommandExists {
    param([string]$Command)
    return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

function Test-WingetAvailable {
    return Test-CommandExists 'winget'
}

function Get-NodeMajorVersion {
    try {
        $raw = & node -e 'process.stdout.write(process.versions.node)' 2>$null
        return [int]($raw -split '\.')[0]
    }
    catch {
        return 0
    }
}

function Ensure-Git {
    if (Test-CommandExists 'git') {
        $ver = & git --version
        Write-Log "git found: $ver"
        return
    }

    Write-Log "git not found — installing via winget..." -Level WARN

    if (-not (Test-WingetAvailable)) {
        throw "winget is not available. Please install git manually: https://git-scm.com/download/win"
    }

    winget install --id Git.Git -e --source winget --silent --accept-package-agreements --accept-source-agreements
    Invoke-RefreshPath

    if (-not (Test-CommandExists 'git')) {
        throw "git installation failed. Please install manually: https://git-scm.com"
    }
    Write-Log "git installed successfully."
}

function Ensure-Node {
    $major = Get-NodeMajorVersion
    if ($major -ge $RequiredNodeMajor) {
        Write-Log "Node $(node -v) found — OK."
        return
    }

    Write-Log "Node >= $RequiredNodeMajor not found (found: $major) — installing..." -Level WARN

    if (-not (Test-WingetAvailable)) {
        throw "winget is not available. Please install Node.js manually: https://nodejs.org"
    }

    winget install --id OpenJS.NodeJS.LTS -e --source winget --silent --accept-package-agreements --accept-source-agreements
    Invoke-RefreshPath

    $major = Get-NodeMajorVersion
    if ($major -lt $RequiredNodeMajor) {
        throw "Node installation failed. Please install Node.js $RequiredNodeMajor+ manually: https://nodejs.org"
    }
    Write-Log "Node $(node -v) installed."
}

function Ensure-Pnpm {
    if (Test-CommandExists 'pnpm') {
        Write-Log "pnpm $(pnpm -v) found."
        return
    }

    Write-Log "pnpm not found — installing via npm..." -Level WARN

    & npm install -g pnpm
    Invoke-RefreshPath

    if (-not (Test-CommandExists 'pnpm')) {
        throw "pnpm installation failed. Please install manually: npm install -g pnpm"
    }
    Write-Log "pnpm $(pnpm -v) installed."
}

function Invoke-CloneOrUpdate {
    $gitDir = Join-Path $TargetDir '.git'

    if (Test-Path $gitDir) {
        Write-Log "Repo already exists at $TargetDir — running git pull..."
        Push-Location $TargetDir
        try {
            & git pull --ff-only
            Write-Log "Repo updated."
        }
        finally {
            Pop-Location
        }
    }
    else {
        Write-Log "Cloning $RepoUrl into $TargetDir..."
        $parent = Split-Path $TargetDir
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        & git clone $RepoUrl $TargetDir
        Write-Log "Repo cloned."
    }
}

function Install-Dependencies {
    Write-Log "Installing npm dependencies via pnpm..."
    Push-Location $TargetDir
    try {
        & pnpm install
        Write-Log "Dependencies installed."
    }
    finally {
        Pop-Location
    }
}

function Invoke-Action {
    Push-Location $TargetDir
    try {
        switch ($Action) {
            'dev' {
                Write-Log "Starting Abyss in dev mode (Vite + Electron, hot reload)..."
                Write-Log "Window will open shortly. Stop with: Ctrl+C"
                Write-Host ""
                & pnpm dev
            }
            'build' {
                Write-Log "Creating production build..."
                & pnpm build
                $releaseDir = Join-Path $TargetDir 'release'
                Write-Log "Build complete. Output: $releaseDir"
                if (Test-Path $releaseDir) {
                    Get-ChildItem $releaseDir -Recurse -File |
                        Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,2)}} |
                        Format-Table -AutoSize
                }
            }
        }
    }
    finally {
        Pop-Location
    }
}

#endregion

#region Main Logic

function Invoke-Main {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║        Abyss Setup — Windows             ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Log "Target directory : $TargetDir"
    Write-Log "Action           : $Action"
    Write-Host ""

    try {
        Ensure-Git
        Ensure-Node
        Ensure-Pnpm
        Invoke-CloneOrUpdate
        Install-Dependencies
        Write-Host ""
        Invoke-Action
    }
    catch {
        Write-Log "Error: $_" -Level ERROR
        Write-Log "StackTrace: $($_.ScriptStackTrace)" -Level DEBUG
        exit 1
    }
}

#endregion

Invoke-Main