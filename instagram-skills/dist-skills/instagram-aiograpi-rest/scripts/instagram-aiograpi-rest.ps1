param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $RemainingArgs
)

$ErrorActionPreference = "Stop"

# 调用随 skill 安装的独立 bundle。
$localBundle = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\dist\cli.bundle.js") -ErrorAction SilentlyContinue
if ($localBundle) {
  $skillRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
  Push-Location $skillRoot
  try {
    & node $localBundle.Path @RemainingArgs
    exit $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

throw "Cannot find instagram-aiograpi-rest CLI bundle in this skill directory."
