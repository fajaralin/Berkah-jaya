Dim objShell, strDir, strBat

Set objShell = CreateObject("WScript.Shell")
strDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
strBat = strDir & "start.bat"

' Check apakah port 3000 sudah aktif
Dim objExec, strOutput
Set objExec = objShell.Exec("cmd /c netstat -n -a -o | findstr "":3000 """)
strOutput = objExec.StdOut.ReadAll()

If InStr(strOutput, ":3000") > 0 Then
    ' Server sudah jalan, langsung buka browser saja
    objShell.Run "cmd /c start http://localhost:3000/dashboard.html", 0, False
Else
    ' Jalankan server tanpa tampilkan jendela CMD (mode: 0 = hidden)
    objShell.Run "cmd /c """ & strBat & """", 0, False
    
    ' Tunggu 3 detik sampai server siap
    WScript.Sleep 3000
    
    ' Buka browser
    objShell.Run "cmd /c start http://localhost:3000/dashboard.html", 0, False
End If

Set objShell = Nothing
