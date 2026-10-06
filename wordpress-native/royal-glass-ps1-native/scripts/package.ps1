$ErrorActionPreference = 'Stop'

$pluginRoot = Split-Path -Parent $PSScriptRoot
$nativeRoot = Split-Path -Parent $pluginRoot
$artifactDirectory = Join-Path $nativeRoot 'artifacts'
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('rg-ps1-native-' + [guid]::NewGuid().ToString('N'))
$stagingPlugin = Join-Path $stagingRoot 'royal-glass-ps1-native'
$artifact = Join-Path $artifactDirectory 'royal-glass-ps1-native.zip'

New-Item -ItemType Directory -Force -Path $artifactDirectory, $stagingPlugin | Out-Null

Copy-Item -LiteralPath (Join-Path $pluginRoot 'royal-glass-ps1-native.php') -Destination $stagingPlugin
Copy-Item -LiteralPath (Join-Path $pluginRoot 'README.md') -Destination $stagingPlugin
Copy-Item -LiteralPath (Join-Path $pluginRoot 'includes') -Destination $stagingPlugin -Recurse
Copy-Item -LiteralPath (Join-Path $pluginRoot 'assets') -Destination $stagingPlugin -Recurse

if (Test-Path -LiteralPath $artifact) {
    Remove-Item -LiteralPath $artifact
}

Compress-Archive -LiteralPath $stagingPlugin -DestinationPath $artifact -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingRoot -Recurse

$sha256 = [System.Security.Cryptography.SHA256]::Create()
$stream = [System.IO.File]::OpenRead($artifact)
try {
    $hashBytes = $sha256.ComputeHash($stream)
    $hashValue = [System.BitConverter]::ToString($hashBytes).Replace('-', '')
} finally {
    $stream.Dispose()
    $sha256.Dispose()
}
Write-Output ("Artifact: {0}" -f $artifact)
Write-Output ("SHA256:  {0}" -f $hashValue)
