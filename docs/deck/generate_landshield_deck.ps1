# Generates Landshield-Deck.pptx via PowerPoint COM automation.
# Uses real Title + Content placeholders (not free text boxes) so any PowerPoint
# theme / Design Ideas can restyle the deck. 16:9, 12 slides.

param([string]$OutputPath = "$PSScriptRoot\Landshield-Deck.pptx")

$ErrorActionPreference = 'Stop'

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = -1   # msoTrue (required for COM)

$pres = $ppt.Presentations.Add()
$pres.PageSetup.SlideWidth  = 960
$pres.PageSetup.SlideHeight = 540

# -- ppSlideLayout enum (the ones we use) ------------------------------------
$LAY_TITLE_SLIDE     = 1   # Title + subtitle (cover, closing)
$LAY_TITLE_AND_BODY  = 2   # Title + body placeholder (bulleted content)
$LAY_TITLE_ONLY      = 11  # Title only (we add shapes/tables ourselves)
$LAY_BLANK           = 12  # No placeholders (we won't use it any more)

# -- Brand palette (BGR for PowerPoint COM) ----------------------------------
$brandPrimary = 0xE8731A   # #1A73E8
$brandDark    = 0xCC6517   # #1765CC
$brandGreen   = 0x3E8E1E   # #1E8E3E
$slate        = 0x68635F   # #5F6368
$ink          = 0x242420   # #202124
$ink2         = 0x43403C   # #3C4043
$tintBlue     = 0xFEE2EA
$tintGreen    = 0xEAF4E6
$tintCyan     = 0xE0F7FE
$tintViolet   = 0xE6E8FC

# --- Placeholder helpers ----------------------------------------------------
# Find a placeholder of a given type on a slide.
#   1 = ppPlaceholderTitle, 2 = ppPlaceholderBody, 3 = ppPlaceholderCenterTitle,
#   4 = ppPlaceholderSubtitle
function Get-Placeholder {
    param($slide, [int]$type)
    foreach ($ph in $slide.Shapes.Placeholders) {
        if ($ph.PlaceholderFormat.Type -eq $type) { return $ph }
    }
    return $null
}

function Set-PlaceholderText {
    param($placeholder, [string]$text)
    if ($null -eq $placeholder) { return }
    $tr = $placeholder.TextFrame.TextRange
    $tr.Text = $text
    $tr.Font.Name = 'Calibri'
}

# Push an array of bullet strings into the body placeholder.
# Lines are kept as-is so the theme styles them with its own bullet glyph.
function Set-BodyBullets {
    param($slide, [string[]]$bullets)
    $body = Get-Placeholder $slide 2
    if ($null -eq $body) { return }
    $tf = $body.TextFrame
    $tr = $tf.TextRange
    $tr.Text = ($bullets -join "`r")
    $tr.Font.Name = 'Calibri'
    # Let the theme decide colour / size; only enforce a sensible cap.
    if ($tr.Font.Size -gt 20) { $tr.Font.Size = 18 }
}

# Set the slide title.
function Set-Title {
    param($slide, [string]$text)
    $title = Get-Placeholder $slide 1
    if ($null -eq $title) { $title = Get-Placeholder $slide 3 }   # center title
    Set-PlaceholderText $title $text
}

function Set-Subtitle {
    param($slide, [string]$text)
    $sub = Get-Placeholder $slide 4
    Set-PlaceholderText $sub $text
}

function Add-ContentSlide {
    param([string]$Title, [string[]]$Bullets)
    $idx = $pres.Slides.Count + 1
    $s = $pres.Slides.Add($idx, $LAY_TITLE_AND_BODY)
    Set-Title $s $Title
    Set-BodyBullets $s $Bullets
    return $s
}

function Add-TitleOnlySlide {
    param([string]$Title)
    $idx = $pres.Slides.Count + 1
    $s = $pres.Slides.Add($idx, $LAY_TITLE_ONLY)
    Set-Title $s $Title
    return $s
}

# --- Lightweight shape helpers (for diagram slides only) --------------------
function Add-Rect {
    param($slide, $x, $y, $w, $h, $fill, $line = $null, $shape = 1)
    $s = $slide.Shapes.AddShape($shape, $x, $y, $w, $h)
    $s.Fill.ForeColor.RGB = $fill
    if ($null -eq $line) { $s.Line.Visible = $false }
    else { $s.Line.ForeColor.RGB = $line; $s.Line.Weight = 0.75 }
    return $s
}

function Add-ShapeText {
    param($shape, [string]$text, $size = 12, $bold = $false, $color = 0x242420,
          $align = 'center', $vAnchor = 'middle')
    $tf = $shape.TextFrame
    $tf.WordWrap = $true
    $tf.MarginLeft = 4; $tf.MarginRight = 4; $tf.MarginTop = 2; $tf.MarginBottom = 2
    switch ($vAnchor) {
        'top'    { $tf.VerticalAnchor = 1 }
        'middle' { $tf.VerticalAnchor = 3 }
        'bottom' { $tf.VerticalAnchor = 4 }
    }
    $tr = $tf.TextRange
    $tr.Text = [string]$text
    $tr.Font.Name = 'Calibri'
    $tr.Font.Size = $size
    $tr.Font.Bold = $bold
    $tr.Font.Color.RGB = $color
    switch ($align) {
        'left'   { $tr.ParagraphFormat.Alignment = 1 }
        'center' { $tr.ParagraphFormat.Alignment = 2 }
        'right'  { $tr.ParagraphFormat.Alignment = 3 }
    }
}

function Add-Textbox {
    param($slide, $x, $y, $w, $h, [string]$text, $size = 12, $bold = $false,
          $color = 0x242420, $align = 'left', $vAnchor = 'top')
    $s = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
    Add-ShapeText -shape $s -text $text -size $size -bold $bold -color $color `
                  -align $align -vAnchor $vAnchor
    return $s
}

function Add-Arrow {
    param($slide, $x1, $y1, $x2, $y2, $color = 0x68635F)
    $s = $slide.Shapes.AddConnector(1, $x1, $y1, $x2, $y2)
    $s.Line.ForeColor.RGB     = $color
    $s.Line.Weight            = 1.5
    $s.Line.EndArrowheadStyle = 2
    return $s
}

# ============================================================================
# SLIDE 1 - Cover (Title slide layout, theme decides background)
# ============================================================================
$cover = $pres.Slides.Add(1, $LAY_TITLE_SLIDE)
Set-Title    $cover 'Landshield'
Set-Subtitle $cover "AI-powered due diligence for Indian land documents`rInfosys Gemini Hackathon 2026 - Team Submission"

# ============================================================================
# SLIDE 2 - Team & Use Case (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Team & Use Case' -Bullets @(
    'Team: Landshield - Member: Abhishek Partap S - DU: AI Altitude',
    'Use case: AI-powered land document verification for Indian buyers',
    'Domain: Real Estate / Legal Tech - Sub-domain: Document verification, fraud detection, due-diligence assistance',
    'What it does: Ingests a bundle of land documents (sale deed, EC, mutation, tax receipt, building plan), extracts structured data, validates against Indian land law (TPA, Roshni Act, tribal-land rules, RERA), flags fraud indicators, and produces a lawyer-style report graded by severity',
    'Outcome: Buyer gets a clear go / clarify / stop verdict in seconds instead of weeks of manual due diligence'
) | Out-Null

# ============================================================================
# SLIDE 3 - Solution Design (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Solution Design' -Bullets @(
    'Orchestrator (FastAPI on Cloud Run): receives the bundle, fans out parallel agent calls, streams progress via SSE, persists to Firestore',
    'Parser Agent (Gemini): reads PDFs natively, extracts parties, area, stamp duty, registration details, chain of title, dates',
    'Legal Rules Agent (Gemini): maps extracted data against Indian land law - registration, stamp duty, state restrictions, RERA',
    'Fraud Detection Agent (Gemini): flags name mismatches, chain-of-title gaps, undervaluation, fake registration patterns',
    'Report Agent (Gemini): consolidates findings into a lawyer-style summary with severity grading and recommendations',
    'Storage: GCS for source PDFs (signed URLs), Firestore for analysis state and audit log',
    'Frontend (Next.js on Cloud Run): dashboard, upload, real-time progress, report viewer - Firebase Auth gates access',
    'Observability: Cloud Logging + Monitoring - structured logs, agent latency, model cost, alerts'
) | Out-Null

# ============================================================================
# SLIDE 4 - Solution Architecture (Title only + layered diagram)
# ============================================================================
$s = Add-TitleOnlySlide 'Solution Architecture'
$y0 = 120

# Presentation layer
$r = Add-Rect $s 40 $y0 880 50 $tintBlue 0xFAC8C8 5
Add-ShapeText $r "PRESENTATION`rNext.js frontend on Cloud Run - Firebase Auth - dashboard - upload - real-time progress - report viewer" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14

# Orchestration layer
$y0 += 60
$r = Add-Rect $s 40 $y0 880 50 $tintBlue 0xFAC8C8 5
Add-ShapeText $r "ORCHESTRATION`rFastAPI orchestrator on Cloud Run - SSE streaming - fans out parallel agent calls - persists state to Firestore" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14

# Agents layer
$y0 += 60
$r = Add-Rect $s 40 $y0 880 100 $tintGreen 0xC8E5BD 5
Add-ShapeText $r 'AGENTS (GEMINI 2.5-FLASH)' 11 $true $brandGreen 'left' 'top'
$r.TextFrame.MarginLeft = 14; $r.TextFrame.MarginTop = 8
$ax = 60
foreach ($a in @('Parser','Legal Rules','Fraud Detection','Report')) {
    $b = Add-Rect $s $ax ($y0 + 32) 200 56 0xFFFFFF 0xC8E5BD 5
    Add-ShapeText $b "$a`rGemini 2.5-flash" 12 $true $brandDark 'center' 'middle'
    $ax += 210
}

# Data + cross-cutting
$y0 += 110
$r = Add-Rect $s 40 $y0 420 50 $tintCyan 0x8BDDFA 5
Add-ShapeText $r "DATA`rGCS (PDFs, signed URLs) - Firestore (findings, audit log)" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14
$r = Add-Rect $s 500 $y0 420 50 $tintViolet 0xBDC7FA 5
Add-ShapeText $r "CROSS-CUTTING`rCloud Logging - Monitoring - IAM - Secret Manager - Artifact Registry" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14

# ============================================================================
# SLIDE 5 - Data Flow (Title + Body, numbered)
# ============================================================================
Add-ContentSlide -Title 'Data Flow' -Bullets @(
    'User uploads a bundle of land documents and selects state + land type',
    'Frontend pushes files to backend; backend stores them in GCS and creates a Firestore record',
    'Orchestrator triggers Parser Agent; Gemini reads each PDF and extracts structured fields',
    'Legal Rules Agent and Fraud Detection Agent run in parallel on the extracted data',
    'Findings are normalised, deduplicated, consolidated, and graded by severity',
    'Report Agent generates a lawyer-style summary with severity counts and recommended actions',
    'Backend persists the report to Firestore and streams progress to the frontend via SSE',
    'User views the report: property facts, findings, checklist, parties, document inventory',
    'Cloud Logging and Monitoring capture latency, errors, and cost throughout'
) | Out-Null

# ============================================================================
# SLIDE 6 - Flow Diagram (Title only + shape flow)
# ============================================================================
$s = Add-TitleOnlySlide 'Flow Diagram'

$row1Y = 120
$bw = 140; $bh = 56; $gap = 25
$xs = @(40, (40+$bw+$gap), (40+($bw+$gap)*2), (40+($bw+$gap)*3), (40+($bw+$gap)*4))
$nodes = @(
    @{label='User';        sub='';                        fill=$tintBlue; line=0xFAC8C8; color=$brandPrimary},
    @{label='Next.js';     sub='Frontend / Cloud Run';    fill=$tintBlue; line=0xFAC8C8; color=$brandPrimary},
    @{label='Orchestrator';sub='FastAPI / Cloud Run';     fill=$tintBlue; line=0xFAC8C8; color=$brandDark},
    @{label='GCS';         sub='PDFs (signed URL)';       fill=$tintCyan; line=0x8BDDFA; color=$brandDark},
    @{label='Firestore';   sub='Findings + audit';        fill=$tintCyan; line=0x8BDDFA; color=$brandDark}
)
for ($k = 0; $k -lt 5; $k++) {
    $n = $nodes[$k]
    $b = Add-Rect $s $xs[$k] $row1Y $bw $bh $n.fill $n.line 5
    Add-ShapeText $b "$($n.label)`r$($n.sub)" 11 $true $n.color 'center' 'middle'
}
for ($k = 0; $k -lt 4; $k++) {
    Add-Arrow $s ($xs[$k] + $bw) ($row1Y + $bh/2) $xs[$k+1] ($row1Y + $bh/2) $slate | Out-Null
}

$orchX = $xs[2] + $bw/2
Add-Arrow $s $orchX ($row1Y + $bh) $orchX ($row1Y + $bh + 30) $slate | Out-Null

$row2Y = $row1Y + $bh + 35
$awidth = 180; $aheight = 56; $agap = 20
$agentStart = (960 - ($awidth*4 + $agap*3)) / 2
$ax = $agentStart
foreach ($a in @('Parser','Legal','Fraud','Report')) {
    $b = Add-Rect $s $ax $row2Y $awidth $aheight $tintGreen 0xC8E5BD 5
    Add-ShapeText $b "$a Agent`rGemini 2.5-flash" 11 $true $brandDark 'center' 'middle'
    $ax += $awidth + $agap
}

$consY = $row2Y + $aheight + 25
Add-Arrow $s 480 ($row2Y + $aheight) 480 $consY $slate | Out-Null
$b = Add-Rect $s 280 $consY 400 50 $tintViolet 0xBDC7FA 5
Add-ShapeText $b "Consolidation + Severity Grading`rdedupe - combine related - grade low/medium/high/critical" 11 $true $brandDark 'center' 'middle'

$repY = $consY + 60
Add-Arrow $s 480 ($consY + 50) 480 $repY $slate | Out-Null
$b = Add-Rect $s 280 $repY 400 46 $tintBlue 0xFAC8C8 5
Add-ShapeText $b "Final Report streamed to Frontend (SSE)`rproperty facts - findings - checklist - parties" 11 $true $brandPrimary 'center' 'middle'

# ============================================================================
# SLIDE 7 - Agent Design (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Agent Design' -Bullets @(
    'Orchestrator (controller): primary entry point - validates the bundle and coordinates the rest',
    'Fan-out: Parser first, then Legal + Fraud in parallel, then Report - progress streamed via SSE',
    'Each specialised Gemini agent has its own focused system prompt and JSON output schema',
    'Parser is multimodal (reads PDFs natively); the rest consume structured JSON',
    'Stateless agents exchange JSON, allowing easy retry and parallelism',
    'In-process Python calls today (sub-second latency, lower cost)',
    'Designed so any agent can be promoted to its own Cloud Run service via HTTP/JSON',
    'A shared ExtractedData schema keeps contracts stable across agents'
) | Out-Null

# ============================================================================
# SLIDE 8 - Agent Details (Title only + real PowerPoint Table)
# ============================================================================
$s = Add-TitleOnlySlide 'Agent Details'
# Shapes.AddTable(rows, cols, x, y, w, h)
$table = $s.Shapes.AddTable(6, 3, 40, 110, 880, 320).Table
$table.Columns.Item(1).Width = 170
$table.Columns.Item(2).Width = 470
$table.Columns.Item(3).Width = 240

$headers = @('Agent', 'What it does', 'Google service')
for ($c = 1; $c -le 3; $c++) {
    $cell = $table.Cell(1, $c)
    $cell.Shape.TextFrame.TextRange.Text = $headers[$c-1]
    $cell.Shape.TextFrame.TextRange.Font.Bold = $true
}

$rows = @(
    @('Orchestrator',          'Receives the bundle, fans out parallel agent calls, streams progress, persists state.',                              'FastAPI / Cloud Run + Firestore'),
    @('Parser Agent',          'Reads PDFs natively. Extracts parties, area, stamp duty, registration details, chain of title.',                      'Vertex AI Gemini 2.5-flash'),
    @('Legal Rules Agent',     'Maps extracted data against Indian land law. Flags only concrete document-specific issues.',                          'Vertex AI Gemini 2.5-flash'),
    @('Fraud Detection Agent', 'Detects name mismatches, chain-of-title gaps, undervaluation. Consolidates related observations.',                    'Vertex AI Gemini 2.5-flash'),
    @('Report Agent',          'Synthesises findings into a lawyer-style summary, grades severity, and recommends next steps.',                       'Vertex AI Gemini 2.5-flash')
)
for ($r = 0; $r -lt $rows.Count; $r++) {
    for ($c = 0; $c -lt 3; $c++) {
        $cell = $table.Cell($r + 2, $c + 1)
        $cell.Shape.TextFrame.TextRange.Text = $rows[$r][$c]
    }
}

# ============================================================================
# SLIDE 9 - Deployment (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Deployment' -Bullets @(
    'Frontend (Next.js): Dockerised, deployed to Cloud Run, CDN-cached static assets',
    'Backend (FastAPI): Dockerised, deployed to Cloud Run, auto-scales 0 -> N, Gunicorn + Uvicorn workers',
    'CI/CD: GitHub push -> Cloud Build -> builds both images -> Artifact Registry -> deploys to Cloud Run',
    'Artifact Registry: stores backend + frontend Docker images, vulnerability scanning enabled',
    'Secret Manager: holds Gemini API keys and Firebase admin credentials; Cloud Run reads at startup',
    'Cloud Storage: bucket for uploaded documents, signed URLs with short TTL, lifecycle expiry',
    'Firestore: native-mode database, stores analysis records, findings, audit log',
    'IAM: dedicated service account per Cloud Run service, least-privilege on Firestore / GCS / Secret Manager',
    'Logging & Monitoring: structured JSON logs, alerts on error rate and Gemini latency',
    'Firebase Auth: email/password and Google sign-in, ID tokens verified server-side per request'
) | Out-Null

# ============================================================================
# SLIDE 10 - Google Technology Stack (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Google Technology Stack' -Bullets @(
    'Vertex AI Gemini 2.5 - multimodal reasoning for parsing, legal analysis, fraud detection, report synthesis',
    'Cloud Run - serverless container hosting for FastAPI backend and Next.js frontend; auto-scales per request',
    'Cloud Storage - signed-URL storage for uploaded land documents',
    'Firestore - document database for analysis state, bundles, findings, audit trail',
    'Firebase Authentication - email/password and Google sign-in with secure tokens to the backend',
    'Cloud Build - GitHub push triggers Docker build, image push, Cloud Run deploy',
    'Artifact Registry - container image storage for backend and frontend',
    'Secret Manager - Gemini API keys and Firebase admin credentials at rest',
    'Cloud Logging & Monitoring - centralised structured logs, latency metrics, error alerting',
    'IAM - least-privilege service accounts for Cloud Run, Firestore, and GCS'
) | Out-Null

# ============================================================================
# SLIDE 11 - How did we arrive at this solution? (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'How did we arrive at this solution?' -Bullets @(
    'Problem observed: Indian land transactions involve 8-10 documents per deal; buyers cannot verify them alone',
    'Lawyers are expensive and slow; fraud patterns (Roshni Act, tribal land, benami) are hard to spot manually',
    'Why an AI agent: Gemini 2.5 reads multi-page PDFs natively and extracts structured fields with high accuracy',
    'A multi-agent layout runs parser, legal, fraud, and report agents in parallel with focused prompts',
    'Findings are consolidated and graded, so the user gets a lawyer-style summary, not raw text',
    'Why Google Cloud: Vertex AI Gemini gives best-in-class multimodal reasoning without managing models ourselves',
    'Cloud Run + Firestore scales from one document to thousands without infra work',
    'Firebase Auth + IAM gives a clean security boundary for sensitive land data'
) | Out-Null

# ============================================================================
# SLIDE 12 - Thank You (Title slide layout, theme styles it)
# ============================================================================
$idx = $pres.Slides.Count + 1
$thanks = $pres.Slides.Add($idx, $LAY_TITLE_SLIDE)
Set-Title    $thanks 'Thank You'
Set-Subtitle $thanks 'Landshield - verify your land. Before you sign.'

# --- Save -------------------------------------------------------------------
if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
$pres.SaveAs($OutputPath, 24)  # ppSaveAsOpenXMLPresentation
$pres.Close()

try { $ppt.Quit() } catch {}
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

Write-Host ""
Write-Host "Deck saved: $OutputPath"
Write-Host "Slides: 12 - 16:9 - uses Title + Content placeholders (theme-friendly)"
Write-Host "Open in PowerPoint, then Design tab -> pick any theme to restyle instantly."

