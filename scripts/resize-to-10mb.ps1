# Resize image to ~10MB (saved as BMP for predictable size)
param(
    [string]$InputPath = "C:\Users\antoi\.cursor\projects\c-Users-antoi-Documents-Netechoppe-VideoGen\assets\source.png",
    [string]$OutputPath = "C:\Users\antoi\Documents\Netechoppe\VideoGen\image-10mb.bmp"
)

Add-Type -AssemblyName System.Drawing

# .NET saves 32bpp BMP: 4 bytes per pixel. For 10MB: 10*1024*1024/4 = 2621440 px, sqrt ~1620
$size = 1620
$img = [System.Drawing.Image]::FromFile((Resolve-Path $InputPath))
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, $size, $size)
$g.Dispose()
$img.Dispose()

$bmp.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp.Dispose()

$bytes = (Get-Item $OutputPath).Length
Write-Host "Saved $OutputPath ($([math]::Round($bytes/1MB, 2)) MB)"
