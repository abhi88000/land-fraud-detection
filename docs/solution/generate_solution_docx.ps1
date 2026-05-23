# Generates Landshield-Solution-Document.docx from the markdown source.
# Pipeline:
#   1. Export deck slides 4 (Architecture) and 6 (Flow) from Landshield-Deck.pptx as PNG.
#   2. Convert markdown -> HTML (md_to_html.py).
#   3. Open HTML in Word and SaveAs .docx (Word embeds the referenced PNGs).
param(
    [string]$MdPath   = "$PSScriptRoot\Landshield-Solution-Document.md",
    [string]$HtmlPath = "$PSScriptRoot\Landshield-Solution-Document.html",
    [string]$DocxPath = "$PSScriptRoot\Landshield-Solution-Document.docx",
    [string]$DeckPath = "$PSScriptRoot\..\deck\Landshield-Deck.pptx"
)

$ErrorActionPreference = 'Stop'

# 0. Export diagram PNGs from the deck (slides: 6 = Flow Diagram, 4 = Architecture)
$deckFull = (Resolve-Path $DeckPath).Path
$flowPng  = Join-Path $PSScriptRoot 'agent-flow.png'
$archPng  = Join-Path $PSScriptRoot 'architecture.png'

Get-Process POWERPNT -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = -1
try {
    $pres = $ppt.Presentations.Open($deckFull, $true, $false, $false)  # ReadOnly
    if (Test-Path $flowPng) { Remove-Item $flowPng -Force }
    if (Test-Path $archPng) { Remove-Item $archPng -Force }

    # Strip theme decoration for a clean diagram on a white page.
    # msoFalse = 0, msoTrue = -1; FillSolid = 1
    foreach ($n in 6, 4) {
        $sl = $pres.Slides.Item($n)
        $sl.DisplayMasterShapes = 0
        $sl.FollowMasterBackground = 0
        $sl.Background.Fill.Visible = -1
        $sl.Background.Fill.Solid()
        $sl.Background.Fill.ForeColor.RGB = 0xFFFFFF
    }

    # Slide.Export(FileName, FilterName, ScaleWidth, ScaleHeight) - 1920x1080
    $pres.Slides.Item(6).Export($flowPng, 'PNG', 1920, 1080)
    $pres.Slides.Item(4).Export($archPng, 'PNG', 1920, 1080)
    $pres.Close()
    Write-Host "Exported: $flowPng"
    Write-Host "Exported: $archPng"
}
finally {
    try { $ppt.Quit() } catch {}
}

# 1. md -> html
python "$PSScriptRoot\md_to_html.py" $MdPath $HtmlPath
if ($LASTEXITCODE -ne 0) { throw "md_to_html.py failed" }

# 2. Open HTML in Word and save as .docx (images are embedded automatically)
$word = New-Object -ComObject Word.Application
$word.Visible = -1   # msoTrue
try {
    $doc = $word.Documents.Open($HtmlPath, $false, $true)  # ReadOnly = true to keep HTML pristine
    # wdFormatDocumentDefault = 16 (.docx)
    if (Test-Path $DocxPath) { Remove-Item $DocxPath -Force }
    $doc.SaveAs([ref]$DocxPath, [ref]16)
    $doc.Close($false)
    Write-Host ""
    Write-Host "Docx saved: $DocxPath"
}
finally {
    try { $word.Quit() } catch {}
}
