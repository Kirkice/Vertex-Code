[CmdletBinding()]
param(
	[string]$EditorCommand = "code",
	[string]$ExtensionsDirectory = ""
)

$ErrorActionPreference = "Stop"

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot ".." )).Path
$extensionSource = (Resolve-Path (Join-Path $repositoryRoot "src")).Path
$packageJsonPath = Join-Path $extensionSource "package.json"
$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$extensionId = "$($packageJson.publisher).$($packageJson.name)"
$linkName = "$($extensionId.ToLowerInvariant())-$($packageJson.version)"

if ([string]::IsNullOrWhiteSpace($ExtensionsDirectory)) {
	$ExtensionsDirectory = Join-Path $env:USERPROFILE ".vscode\extensions"
}

$extensionsDirectory = [System.IO.Path]::GetFullPath($ExtensionsDirectory)
$linkPath = Join-Path $extensionsDirectory $linkName

if (-not (Test-Path -LiteralPath $extensionsDirectory -PathType Container)) {
	New-Item -ItemType Directory -Path $extensionsDirectory -Force | Out-Null
}

Write-Host "Installing linked extension: $extensionId"
Write-Host "Source: $extensionSource"
Write-Host "Link:   $linkPath"

# Remove the registered copy first. This is limited to the exact extension ID.
# VS Code only considers extensions that it has registered in its profile.
# Register the current VSIX once if needed, then keep that registered root and
# replace the large changing directories with Junctions.
$vsixPath = Join-Path $repositoryRoot "bin\vertex-$($packageJson.version).vsix"
$registeredExtensions = @(& $EditorCommand --list-extensions 2>$null)
$isRegistered = $registeredExtensions -contains $extensionId.ToLowerInvariant()
if (-not $isRegistered) {
    if (-not (Test-Path -LiteralPath $vsixPath -PathType Leaf)) {
        throw "The extension is not installed and the bootstrap VSIX is missing: $vsixPath"
    }
    & $EditorCommand --install-extension $vsixPath --force
    if ($LASTEXITCODE -ne 0) {
        throw "VS Code failed to register the extension from $vsixPath (exit code $LASTEXITCODE)."
    }
}

if ((Split-Path -Parent $linkPath) -ne $extensionsDirectory) {
    throw "Refusing to modify an unexpected extension path: $linkPath"
}

# VS Code ignores an extension when the extension root itself is a Junction.
# Keep the registered root as a normal directory, and link the large
# build/runtime directories into it instead.
New-Item -ItemType Directory -Path $linkPath -Force | Out-Null

# VS Code validates the whole extension manifest set, not just package.json.
# Copy the small top-level files (package.nls*.json, README, .vsixmanifest,
# etc.) and link the large source/runtime directories below.
Get-ChildItem -LiteralPath $extensionSource -File -Force | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $linkPath $_.Name) -Force
}

foreach ($directoryName in @("dist", "assets", "webview-ui", "bin")) {
    $sourceDirectory = Join-Path $extensionSource $directoryName
    if (Test-Path -LiteralPath $sourceDirectory -PathType Container) {
        $destinationDirectory = Join-Path $linkPath $directoryName
        if (Test-Path -LiteralPath $destinationDirectory) {
            Remove-Item -LiteralPath $destinationDirectory -Recurse -Force
        }
        New-Item -ItemType Junction -Path $destinationDirectory -Target $sourceDirectory | Out-Null
    }
}

Write-Host "Linked extension installed successfully."
Write-Host "Run: pnpm --filter @roo-code/vscode-webview build"
Write-Host "Then: pnpm --filter vertex bundle"
Write-Host "Then use Developer: Reload Window in VS Code."
