$ErrorActionPreference = 'Stop'
try {
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    & $node (Join-Path $PSScriptRoot 'tools\install-native-pets.cjs')
    if ($LASTEXITCODE -ne 0) { throw '安装检查失败，请查看上方输出。' }
    Write-Host '已安装肥嘟嘟。在 Codex 设置的 Pets 页面刷新并选择肥嘟嘟，然后用 /pet 显示。'
    Write-Host '已迁移到云端的旧宠物需要更新云端素材，本脚本仅安装本地包。'
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
