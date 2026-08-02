<#
  setup-bash.ps1 - bootstrap bash.exe for the terminal tool.

  NOTE: keep this file ASCII-only. Windows PowerShell 5.1 reads BOM-less .ps1
  files as ANSI, so non-ASCII characters (em dashes etc.) render as mojibake.

  The app's terminal executor requires bash.exe (Git Bash / MSYS2) and will
  not start ANY command without it. This script:

    1. Detects a REAL bash (Git Bash or MSYS2) in standard install locations.
       WSL's C:\Windows\System32\bash.exe is deliberately NOT accepted: it is
       a Linux launcher, not a Git-Bash-like shell, and would break commands
       like git/pnpm that expect Windows binaries.
    2. If none is found, installs Git for Windows - via winget (user scope)
       first, then the official standalone installer - with exit-code
       verification at every step.
    3. Sets CODEBUFF_GIT_BASH_PATH as a user environment variable.
    4. Prints what to do next (restart the app).

  After this runs once, everything else (git, pnpm install, typecheck, tests,
  eval, Docker) is fully automatable.

  Usage:
    Right-click -> Run with PowerShell
    or: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\setup-bash.ps1
#>

$ErrorActionPreference = 'Stop'

# Real bash candidates only. No WSL launcher (Linux env, wrong binaries).
$candidates = @(
  "$env:ProgramFiles\Git\bin\bash.exe",          # machine-wide Git for Windows
  "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
  "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe", # user-scope winget install
  "$env:ProgramFiles\Git\usr\bin\bash.exe",
  'C:\msys64\usr\bin\bash.exe'                   # MSYS2
)

function Find-ExistingBash {
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { return $c }
  }
  return $null
}

function Set-BashPath([string]$path) {
  [Environment]::SetEnvironmentVariable('CODEBUFF_GIT_BASH_PATH', $path, 'User')
  Write-Host "[setup-bash] CODEBUFF_GIT_BASH_PATH = $path (user env var set)."
  Write-Host "[setup-bash] Done. Fully close and restart the app so it picks up the variable."
}

$found = Find-ExistingBash
if ($found) {
  Write-Host "[setup-bash] Found existing bash: $found"
  Set-BashPath $found
  exit 0
}

# Only after the detection pass failed do we warn about WSL (which is never a
# usable candidate) and proceed to install Git for Windows.
$wslBash = 'C:\Windows\System32\bash.exe'
if (Test-Path -LiteralPath $wslBash) {
  Write-Host "[setup-bash] Note: WSL bash exists but is NOT used - it launches a Linux"
  Write-Host "           environment, not Windows git/pnpm. Installing Git for Windows instead."
}

Write-Host "[setup-bash] No bash.exe found. Installing Git for Windows..."

# --- Path 1: winget (Windows 10/11; --scope user = no admin) ---
$winget = Get-Command winget -ErrorAction SilentlyContinue
if ($winget) {
  Write-Host "[setup-bash] Trying winget (user scope)..."
  & winget install --id Git.Git -e --scope user `
    --accept-package-agreements --accept-source-agreements --disable-interactivity
  $wingetCode = $LASTEXITCODE
  if ($wingetCode -eq 0) {
    $gitBash = "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
    if (-not (Test-Path -LiteralPath $gitBash)) { $gitBash = "$env:ProgramFiles\Git\bin\bash.exe" }
    if (Test-Path -LiteralPath $gitBash) {
      Set-BashPath $gitBash
      exit 0
    }
    Write-Warning "[setup-bash] winget exited 0 but bash.exe not found; trying the official installer."
  } else {
    Write-Warning "[setup-bash] winget failed (exit $wingetCode); trying the official installer."
  }
}

# --- Path 2: official standalone installer (Inno Setup, silent, per-user) ---
function Install-GitFallback([string]$downloadUrl, [string]$outFile) {
  Write-Host "[setup-bash] Downloading Git for Windows: $downloadUrl"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $outFile -UseBasicParsing
  Write-Host "[setup-bash] Running installer silently (per-user, no restart)..."
  $proc = Start-Process -FilePath $outFile -ArgumentList '/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/SP-' -Wait -PassThru
  if ($proc.ExitCode -ne 0) {
    throw "[setup-bash] Git installer failed with exit code $($proc.ExitCode)."
  }
  $gitBash = "$env:ProgramFiles\Git\bin\bash.exe"
  if (-not (Test-Path -LiteralPath $gitBash)) { $gitBash = "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe" }
  if (-not (Test-Path -LiteralPath $gitBash)) { throw '[setup-bash] Git installed but bash.exe not found at the expected paths.' }
  Set-BashPath $gitBash
  exit 0
}

# Preferred: latest release from the GitHub API.
$headers = @{ 'User-Agent' = 'ph-compliance-mcp-setup' }
try {
  $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/git-for-windows/git/releases/latest' -Headers $headers
  $asset = $release.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1
  if ($asset) {
    $exe = Join-Path $env:TEMP $asset.name
    Install-GitFallback $asset.browser_download_url $exe
  } else {
    Write-Warning "[setup-bash] No 64-bit installer in the latest release; trying a pinned release."
  }
} catch {
  Write-Warning "[setup-bash] GitHub API unavailable ($($_.Exception.Message)); trying a pinned release."
}

# Fallback: a known-good pinned release (kept current; dependabot/ops update it).
$pinnedUrl = 'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe'
$pinnedExe = Join-Path $env:TEMP 'Git-2.47.1-64-bit.exe'
try {
  Install-GitFallback $pinnedUrl $pinnedExe
} catch {
  Write-Host "[setup-bash] ERROR: could not install Git for Windows: $($_.Exception.Message)"
  Write-Host "[setup-bash] Manual fallback: download Git from https://git-scm.com/download/win,"
  Write-Host "[setup-bash] install it, then re-run this script (it will detect the new bash.exe)."
  exit 1
}
