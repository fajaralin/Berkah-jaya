Set WshShell = CreateObject("WScript.Shell")
strPath = WshShell.CurrentDirectory & "\start.bat"
WshShell.Run "cmd /c """ & strPath & """", 1, False
