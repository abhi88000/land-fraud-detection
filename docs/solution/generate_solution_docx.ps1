# Generates Landshield-Solution-Document.docx from the markdown source.
# Pipeline: markdown -> HTML (via md_to_html.py) -> Word COM opens HTML -> SaveAs .docx
param(
    [string]$MdPath   = "$PSScriptRoot\Landshield-Solution-Document.md",
    [string]$HtmlPath = "$PSScriptRoot\Landshield-Solution-Document.html",
    [string]$DocxPath = "$PSScriptRoot\Landshield-Solution-Document.docx"
)

$ErrorActionPreference = 'Stop'

# 1. md -> html
python "$PSScriptRoot\md_to_html.py" $MdPath $HtmlPath
if ($LASTEXITCODE -ne 0) { throw "md_to_html.py failed" }

# 2. Open HTML in Word and save as .docx
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
