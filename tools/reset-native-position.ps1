$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework
try {
    $node = (Get-Command node.exe).Source
    $result = & $node (Join-Path $PSScriptRoot 'reset-native-position.cjs') 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        [System.Windows.MessageBox]::Show($result, '宠物位置修复') | Out-Null
        exit 1
    }
    [System.Windows.MessageBox]::Show($result, '宠物位置修复完成') | Out-Null
    Start-Process 'codex://settings'
} catch {
    [System.Windows.MessageBox]::Show($_.Exception.Message, '宠物位置修复失败') | Out-Null
    exit 1
}
