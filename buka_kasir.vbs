Dim objShell, strDir, strBat
Set objShell = CreateObject("WScript.Shell")
strDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
strBat = strDir & "start.bat"

Function IsPort3000Active()
    Dim objExec, strOutput
    Set objExec = objShell.Exec("cmd /c netstat -n -a -o | findstr "":3000 """)
    strOutput = objExec.StdOut.ReadAll()
    If InStr(strOutput, ":3000") > 0 Then
        IsPort3000Active = True
    Else
        IsPort3000Active = False
    End If
End Function

If IsPort3000Active() Then
    ' Server sudah aktif, langsung buka browser
    objShell.Run "cmd /c start http://localhost:3000/dashboard.html", 0, False
Else
    ' Jalankan server di background
    objShell.Run "cmd /c """ & strBat & """", 0, False

    ' Loop tunggu sampai server benar-benar siap (maksimal 20 detik)
    Dim i
    For i = 1 To 40
        WScript.Sleep 500
        If IsPort3000Active() Then
            Exit For
        End If
    Next

    ' Setelah server terdeteksi siap, baru buka browser
    WScript.Sleep 300
    objShell.Run "cmd /c start http://localhost:3000/dashboard.html", 0, False
End If

Set objShell = Nothing
