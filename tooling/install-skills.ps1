# install-skills.ps1 — link every skill in this directory into a .claude\skills\ farm.
# Creates one directory junction per skill (no admin rights required). Idempotent.
#
# Usage (from the project root or anywhere):
#   .\.agents\skills\install-skills.ps1                       # project scope: <repo>\.claude\skills\
#   .\.agents\skills\install-skills.ps1 -Target "$HOME\.claude\skills"   # user scope
param(
    [string]$Target = ""
)

$ErrorActionPreference = "Stop"
$SuiteRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $Target) {
    # Default: <repo-root>\.claude\skills, where repo root = parent of .agents\
    $RepoRoot = Split-Path -Parent (Split-Path -Parent $SuiteRoot)
    $Target = Join-Path $RepoRoot ".claude\skills"
}

New-Item -ItemType Directory -Force $Target | Out-Null

$linked = 0; $skipped = 0
Get-ChildItem -Directory $SuiteRoot | ForEach-Object {
    $name = $_.Name
    if ($name -like "*-workspace") { return }   # eval artifacts, not skills
    if (-not (Test-Path (Join-Path $_.FullName "SKILL.md"))) { return }
    $link = Join-Path $Target $name
    if (Test-Path $link) {
        $existing = Get-Item $link -Force
        if ($existing.LinkType) {
            $skipped++
            return   # already a link — leave it
        }
        Write-Warning "$name exists at target as a REAL directory - not touching it."
        return
    }
    New-Item -ItemType Junction -Path $link -Target $_.FullName | Out-Null
    $linked++
}
Write-Host "Linked $linked skill(s) into $Target ($skipped already linked)."
Write-Host "Prerequisites: dxs CLI on PATH; python 3.10+ (pip install pyyaml for skill validation)."
Write-Host "Optional save-gate hook: see component-validator\scripts\INSTALL.md"
