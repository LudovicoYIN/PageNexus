$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutDir = Join-Path $RootDir "node-runtime\bin"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "node not found in PATH"
}

$NodeBin = (Get-Command node).Source
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
Copy-Item -Path $NodeBin -Destination (Join-Path $OutDir "node.exe") -Force

Write-Host "Prepared bundled node runtime: $(Join-Path $OutDir 'node.exe')"
