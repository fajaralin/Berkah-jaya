$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "Kasir Berkah Jaya.lnk"
$vbsPath = Join-Path $PSScriptRoot "buka_kasir.vbs"
$iconPath = Join-Path $PSScriptRoot "icon.ico"

$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = """$vbsPath"""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.IconLocation = "$iconPath,0"
$shortcut.Save()

Write-Host "Shortcut dengan ikon kustom berhasil diperbarui di Desktop!"
