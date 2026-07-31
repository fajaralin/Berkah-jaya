Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\Users\FAJAR\.gemini\antigravity-ide\brain\6edcaea0-a473-4e4f-974d-43526452bae6\kasir_berkah_jaya_icon_1785533502108.png'
$icoPath = 'd:\Berkah Jaya\icon.ico'

$img = [System.Drawing.Image]::FromFile($srcPath)
$bmp = New-Object System.Drawing.Bitmap(256, 256)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, 256, 256)
$g.Dispose()

$ms = New-Object System.IO.MemoryStream
$bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $ms.ToArray()
$ms.Dispose()

$iconStream = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter($iconStream)

# ICO header
$w.Write([int16]0)    # reserved
$w.Write([int16]1)    # type: icon
$w.Write([int16]1)    # number of images

# Image directory entry
$w.Write([byte]0)     # width (0 = 256)
$w.Write([byte]0)     # height (0 = 256)
$w.Write([byte]0)     # color count
$w.Write([byte]0)     # reserved
$w.Write([int16]1)    # planes
$w.Write([int16]32)   # bit count
$w.Write([int32]$pngBytes.Length)
$w.Write([int32]22)   # offset to image data

# Image data
$w.Write($pngBytes)

[System.IO.File]::WriteAllBytes($icoPath, $iconStream.ToArray())

$img.Dispose()
$bmp.Dispose()
$iconStream.Dispose()

Write-Host "Icon berhasil dibuat: $icoPath"
