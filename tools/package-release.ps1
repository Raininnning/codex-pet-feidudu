$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
$version = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
if (-not [string]::IsNullOrWhiteSpace((& git status --porcelain | Out-String))) { throw '请先提交源码，确保打包对应已提交版本。' }
$source = Join-Path $projectRoot 'native-pets\feidudu'
$report = Get-Content -LiteralPath (Join-Path $source 'validation.json') -Raw | ConvertFrom-Json
$digest = (Get-FileHash -LiteralPath (Join-Path $source 'spritesheet.png') -Algorithm SHA256).Hash.ToLowerInvariant()
if (-not $report.ok -or $digest -ne $report.sha256) { throw '精灵图与校验报告不一致。' }
$dist = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'dist'))
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$stage = [System.IO.Path]::GetFullPath((Join-Path $dist ('native-stage-' + [Guid]::NewGuid().ToString('N'))))
if (-not $stage.StartsWith($dist + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw '临时目录路径越界。' }
New-Item -ItemType Directory -Path (Join-Path $stage 'native-pets\feidudu') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stage 'tools') -Force | Out-Null
try {
    foreach ($file in @('pet.json', 'spritesheet.png', 'validation.json')) { Copy-Item -LiteralPath (Join-Path $source $file) -Destination (Join-Path $stage 'native-pets\feidudu') }
    foreach ($file in @('README.md', 'LICENSE', 'ASSETS.md', '安装肥嘟嘟.ps1')) { Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination $stage }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'install-native-pets.cjs') -Destination (Join-Path $stage 'tools')
    New-Item -ItemType Directory -Path (Join-Path $stage 'docs\previews') -Force | Out-Null
    foreach ($file in @('hover-six-frames.gif', 'native-waving.gif')) { Copy-Item -LiteralPath (Join-Path $projectRoot ('docs\previews\' + $file)) -Destination (Join-Path $stage 'docs\previews') }
    $nativeZip = Join-Path $dist "feidudu-native-v$version.zip"
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $nativeZip -Force
    $sourceZip = Join-Path $dist "feidudu-source-v$version.zip"
    & git archive --format=zip --prefix="feidudu-v$version/" --output=$sourceZip HEAD
    if ($LASTEXITCODE -ne 0) { throw '源码归档失败。' }
    $checksums = foreach ($file in @($nativeZip, $sourceZip)) {
        $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
        "$hash  $([System.IO.Path]::GetFileName($file))"
    }
    [System.IO.File]::WriteAllLines((Join-Path $dist 'SHA256SUMS.txt'), $checksums, [System.Text.UTF8Encoding]::new($false))
    Write-Output $checksums
} finally {
    # 只清理经过绝对路径边界检查的本次打包临时目录。
    if ($stage.StartsWith($dist + [System.IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $stage -Recurse -Force }
}
