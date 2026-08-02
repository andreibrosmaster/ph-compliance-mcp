# Windows Setup (one-time)

The app's terminal executor requires **`bash.exe`** (Git Bash). It refuses to
start any command — `npm`, `pnpm`, `git`, `winget`, `choco` — until bash exists,
because commands need a shell. Installing Git for Windows (which ships bash)
unblocks everything else.

## Option A — one double-click (recommended)

1. Open `ph-legal-mcp/scripts/` in Explorer.
2. Double-click **`setup-bash.cmd`** (or right-click `setup-bash.ps1` → *Run
   with PowerShell*).
3. The script detects existing bash (**Git Bash / MSYS2 only — WSL is
   deliberately skipped**, see below), or installs Git for Windows silently
   (per-user, winget first, official installer as fallback — exit codes
   verified), then sets the `CODEBUFF_GIT_BASH_PATH` user environment variable.
4. **Fully close and restart the app.**
5. Tell the assistant to continue — it will run the commit sequence and the
   first-run gate (`pnpm install`, `typecheck`, `test`, `eval`) on its own.

> If the silent installer is blocked by a UAC/elevation prompt, install Git
> manually from <https://git-scm.com/download/win> (defaults are fine) and
> re-run the script — it will detect the new `bash.exe`.

## Why WSL is not used

`C:\Windows\System32\bash.exe` is the WSL **launcher**: it starts a Linux
environment where `git`/`pnpm` are Linux binaries that don't exist or behave
wrongly. The script deliberately excludes it so it never "unblocks" the
terminal tool into a broken environment.

## Option B — manual

If Git for Windows is already installed somewhere unusual, point the app at it
by setting the user env var:

```powershell
[Environment]::SetEnvironmentVariable(
  'CODEBUFF_GIT_BASH_PATH',
  'C:\Program Files\Git\bin\bash.exe',   # your actual path
  'User')
```

Then restart the app.

## Why this exists

Bootstrap ordering: the terminal tool → needs a shell (bash) → bash ships with
Git for Windows → Git for Windows is installed by the script. Once bash
exists, the assistant can run git, pnpm, and every check on its own — no
further manual steps.
