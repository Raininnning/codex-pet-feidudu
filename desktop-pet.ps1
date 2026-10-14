param([switch]$SmokeTest)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Windows.Forms
$appRoot = $PSScriptRoot
$runtimePath = Join-Path $appRoot 'runtime'
New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
$mutex = New-Object System.Threading.Mutex($false, 'Local\KangarooCombinedPet')
if (-not $mutex.WaitOne(0)) { exit }
$service = $null
try {
    $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
    if (-not $node) { throw '未找到 Node.js，请先安装 Node.js 22 或更高版本。' }
    $arguments = '"' + (Join-Path $appRoot 'pet-service.js') + '"'
    if ($SmokeTest) { $arguments += ' --test' }
    $service = Start-Process -FilePath $node -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'service-out.log') -RedirectStandardError (Join-Path $runtimePath 'service-error.log')
    $connection = $null
    for ($i = 0; $i -lt 100; $i++) {
        Start-Sleep -Milliseconds 100
        if ($service.HasExited) { throw '状态服务启动失败，请查看 runtime/service-error.log。' }
        try {
            $candidate = Get-Content -LiteralPath (Join-Path $runtimePath 'connection.json') -Raw | ConvertFrom-Json
            if ($candidate.pid -eq $service.Id) { $connection = $candidate; break }
        } catch { }
    }
    if (-not $connection) { throw '状态服务启动超时。' }
    $client = New-Object System.Net.WebClient
    $client.Encoding = [System.Text.Encoding]::UTF8
    $client.Headers['Content-Type'] = 'application/json'
    function Set-PetControl($control) {
        $null = $client.UploadString($connection.url + '/control', ($control | ConvertTo-Json -Compress))
    }
    [xml]$xaml = @'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
 xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="肥嘟嘟"
 Width="260" Height="310" WindowStyle="None" AllowsTransparency="True"
 Background="Transparent" Topmost="True" ShowInTaskbar="False" ResizeMode="NoResize">
 <Grid Margin="7">
  <Grid.RowDefinitions><RowDefinition Height="*"/><RowDefinition Height="52"/></Grid.RowDefinitions>
  <Image x:Name="PetImage" Stretch="Uniform" Cursor="SizeAll" ToolTip="拖动袋鼠；右键选择待机姿势或退出"/>
  <Border x:Name="Toolbar" Grid.Row="1" Background="White" CornerRadius="23"
    Width="104" Height="44" HorizontalAlignment="Center" VerticalAlignment="Top">
   <Border.Effect><DropShadowEffect BlurRadius="12" ShadowDepth="2" Opacity="0.18"/></Border.Effect>
   <Grid Margin="6"><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="1"/><ColumnDefinition/></Grid.ColumnDefinitions>
    <Button x:Name="OpenCodex" FontFamily="Segoe UI Symbol" FontSize="23" Content="✎" Background="Transparent" BorderThickness="0" Cursor="Hand" ToolTip="打开 Codex"/>
    <Border Grid.Column="1" Margin="0,8" Background="#ECECEC"/>
    <Button x:Name="Settings" Grid.Column="2" FontSize="25" Content="⋯" Background="Transparent" BorderThickness="0" Cursor="Hand" ToolTip="姿势、大小和退出"/>
   </Grid>
  </Border>
 </Grid>
</Window>
'@
    $window = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $xaml))
    $image = $window.FindName('PetImage'); $toolbar = $window.FindName('Toolbar')
    $cache = @{}
    $lastFrame = $null
    function Update-Pet {
        try {
            $snapshot = $client.DownloadString($connection.url + '/state') | ConvertFrom-Json
            if ($snapshot.frame -ne $script:lastFrame) {
                if (-not $cache.ContainsKey($snapshot.frame)) {
                    $bitmap = New-Object Windows.Media.Imaging.BitmapImage
                    $bitmap.BeginInit(); $bitmap.CacheOption = [Windows.Media.Imaging.BitmapCacheOption]::OnLoad
                    $bitmap.UriSource = New-Object System.Uri((Join-Path $appRoot ('assets\pets\' + $snapshot.frame)))
                    $bitmap.EndInit(); $bitmap.Freeze(); $cache[$snapshot.frame] = $bitmap
                }
                $image.Source = $cache[$snapshot.frame]; $script:lastFrame = $snapshot.frame
            }
            $toolbar.ToolTip = if ($snapshot.connected) { "已连接 Codex · 工作中的会话：$($snapshot.activeCount)" } else { '未检测到 Codex 状态；当前为待机。' }
        } catch { $toolbar.ToolTip = '状态服务暂时不可用。' }
    }
    $toolbar.Add_MouseEnter({ Set-PetControl @{ hovered = $true }; Update-Pet })
    $toolbar.Add_MouseLeave({ Set-PetControl @{ hovered = $false }; Update-Pet })
    $image.Add_MouseLeftButtonDown({ try { $window.DragMove() } catch { } })
    $menu = New-Object Windows.Controls.ContextMenu
    $sit = New-Object Windows.Controls.MenuItem; $sit.Header = '坐姿待机'
    $sit.Add_Click({ Set-PetControl @{ pose = 'sitting' }; Update-Pet }); $null = $menu.Items.Add($sit)
    $reset = New-Object Windows.Controls.MenuItem; $reset.Header = '重置工作状态'
    $reset.Add_Click({ Set-PetControl @{ reset = $true }; Update-Pet }); $null = $menu.Items.Add($reset)
    foreach ($choice in @(@('小',200,250), @('中',260,310), @('大',330,380))) {
        $item = New-Object Windows.Controls.MenuItem; $item.Header = '大小：' + $choice[0]; $item.Tag = @($choice[1], $choice[2])
        $item.Add_Click({ param($sender,$eventArgs) $window.Width = $sender.Tag[0]; $window.Height = $sender.Tag[1] })
        $null = $menu.Items.Add($item)
    }
    $quit = New-Object Windows.Controls.MenuItem; $quit.Header = '退出肥嘟嘟'; $quit.Add_Click({ $window.Close() }); $null = $menu.Items.Add($quit)
    $image.ContextMenu = $menu
    $window.FindName('Settings').Add_Click({ $menu.PlacementTarget = $toolbar; $menu.IsOpen = $true })
    $window.FindName('OpenCodex').Add_Click({
        $app = Get-Process ChatGPT -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($app -and $app.Path) { Start-Process -FilePath $app.Path }
    })
    $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $window.Left = $area.Right - $window.Width - 36; $window.Top = $area.Bottom - $window.Height - 24
    $timer = New-Object Windows.Threading.DispatcherTimer
    $timer.Interval = [TimeSpan]::FromMilliseconds(40); $timer.Add_Tick({ Update-Pet })
    Update-Pet
    if ($SmokeTest) {
        $window.Show(); $window.UpdateLayout()
        Set-PetControl @{ working = $true; hovered = $false }; Update-Pet
        if ($script:lastFrame -notlike 'kangaroo-thinking-*') { throw '思考状态测试失败' }
        $toolbar.RaiseEvent((New-Object Windows.Input.MouseEventArgs([Windows.Input.Mouse]::PrimaryDevice, 0) -Property @{ RoutedEvent = [Windows.UIElement]::MouseEnterEvent }))
        if ($script:lastFrame -notmatch '^kangaroo-hover-[1-6]\.png$') { throw '悬停动画测试失败' }
        Set-PetControl @{ working = $false; pose = 'sitting' }
        $toolbar.RaiseEvent((New-Object Windows.Input.MouseEventArgs([Windows.Input.Mouse]::PrimaryDevice, 0) -Property @{ RoutedEvent = [Windows.UIElement]::MouseLeaveEvent }))
        if ($script:lastFrame -notlike 'kangaroo-idle-sitting-*') { throw '移开恢复测试失败' }
        $window.UpdateLayout()
        $render = New-Object Windows.Media.Imaging.RenderTargetBitmap(260,310,96,96,[Windows.Media.PixelFormats]::Pbgra32)
        $render.Render($window)
        $encoder = New-Object Windows.Media.Imaging.PngBitmapEncoder
        $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($render))
        $stream = [System.IO.File]::Create((Join-Path $runtimePath 'desktop-preview.png')); $encoder.Save($stream); $stream.Close()
        Set-PetControl @{ pose = 'sitting' }; $window.Close(); Write-Output '桌面窗口、透明置顶、思考、悬停与恢复测试通过。'
    } else {
        $timer.Start(); $null = $window.ShowDialog(); $timer.Stop()
    }
} catch {
    $_ | Out-String | Set-Content -LiteralPath (Join-Path $runtimePath 'desktop-error.log') -Encoding UTF8
    if ($SmokeTest) { throw }
    [System.Windows.MessageBox]::Show($_.Exception.Message, '肥嘟嘟启动失败') | Out-Null
} finally {
    if ($service -and -not $service.HasExited) { Stop-Process -Id $service.Id -ErrorAction SilentlyContinue }
    if ($client) { $client.Dispose() }
    $mutex.ReleaseMutex(); $mutex.Dispose()
}
