$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Kasir Berkah Jaya.lnk"
$vbsPath = Join-Path $PSScriptRoot "buka_kasir.vbs"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = """$vbsPath"""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = "shell32.dll,14"
$shortcut.Save()

Write-Host "Shortcut tersembunyi berhasil diperbarui di Desktop!"
