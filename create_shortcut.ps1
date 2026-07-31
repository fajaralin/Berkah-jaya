$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Kasir Berkah Jaya.lnk"
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "cmd.exe"
$shortcut.Arguments = "/c ""$PSScriptRoot\start.bat"""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Save()
Write-Host "Shortcut berhasil dibuat di Desktop!"
