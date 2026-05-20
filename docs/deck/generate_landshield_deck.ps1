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
# Professional navy + slate + gold scheme.
$brandPrimary = 0x5F3A1F   # #1F3A5F deep navy   (primary)
$brandDark    = 0x432A10   # #102A43 darker navy (titles/accents)
$brandGreen   = 0x0B86B8   # #B8860B muted gold  (accent / agent tier)
$slate        = 0x80644A   # #4A6480 slate       (connectors)
$ink          = 0x53402E   # #2E4053 ink         (body text)
$ink2         = 0x7E6D5D   # #5D6D7E soft ink    (secondary text)
$tintBlue     = 0xF8F1EA   # #EAF1F8 light navy tint
$tintGreen    = 0xDDF3FA   # #FAF3DD light gold tint
$tintCyan     = 0xF8F4F0   # #F0F4F8 light slate tint
$tintViolet   = 0xF3EDE6   # #E6EDF3 cool stone tint

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
    'Team Landshield - Abhishek Partap S - DU: AI Altitude',
    'Domain: Real Estate and Legal Tech - verifying land documents for Indian buyers',
    'Problem: buying land in India needs 8 to 10 documents - one wrong paper and the buyer loses everything',
    'Solution: an AI assistant that reads the full bundle - sale deed, EC, mutation, tax receipt, building plan',
    'It checks the documents against Indian land law and flags fraud signs in plain language',
    'Outcome: the buyer gets a clear Go, Clarify or Stop answer in under a minute, not weeks'
) | Out-Null

# ============================================================================
# SLIDE 3 - Solution Design (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Solution Design' -Bullets @(
    'Orchestrator: a backend that takes the documents and runs the four AI agents in order',
    'Parser Agent: reads each PDF and pulls out names, area, dates, stamp duty and registration details',
    'Legal Agent: checks if the documents follow Indian land law and flags any non-compliance',
    'Fraud Agent: looks for red flags like name mismatches, broken ownership chains and undervaluation',
    'Report Agent: combines all findings into a short summary with a severity grade and next steps',
    'Frontend: a simple web app that shows live progress and the final report, secured by Firebase login',
    'Storage: documents in Cloud Storage, results and audit trail in Firestore',
    'Everything is monitored: logs, latency and errors are tracked in Google Cloud Monitoring'
) | Out-Null

# ============================================================================
# SLIDE 4 - Solution Architecture (Title only + layered diagram)
# ============================================================================
$s = Add-TitleOnlySlide 'Solution Architecture'
$y0 = 120

# Presentation layer
$r = Add-Rect $s 40 $y0 880 50 $tintBlue 0xE8D8C8 5
Add-ShapeText $r "PRESENTATION`rNext.js web app on Cloud Run - login, upload, live progress, final report" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14

# Orchestration layer
$y0 += 60
$r = Add-Rect $s 40 $y0 880 50 $tintBlue 0xE8D8C8 5
Add-ShapeText $r "ORCHESTRATION`rFastAPI backend on Cloud Run - runs the agents, streams progress, saves results" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14

# Agents layer
$y0 += 60
$r = Add-Rect $s 40 $y0 880 100 $tintGreen 0x6FB8DA 5
Add-ShapeText $r 'AGENTS (GEMINI 2.5-FLASH)' 11 $true $brandGreen 'left' 'top'
$r.TextFrame.MarginLeft = 14; $r.TextFrame.MarginTop = 8
$ax = 60
foreach ($a in @('Parser','Legal Rules','Fraud Detection','Report')) {
    $b = Add-Rect $s $ax ($y0 + 32) 200 56 0xFFFFFF 0x6FB8DA 5
    Add-ShapeText $b "$a`rGemini 2.5-flash" 12 $true $brandDark 'center' 'middle'
    $ax += 210
}

# Data + cross-cutting
$y0 += 110
$r = Add-Rect $s 40 $y0 420 50 $tintCyan 0xD4C8B8 5
Add-ShapeText $r "DATA`rCloud Storage for PDFs - Firestore for results and audit log" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14
$r = Add-Rect $s 500 $y0 420 50 $tintViolet 0xDED5C8 5
Add-ShapeText $r "SECURITY and OPERATIONS`rLogging, Monitoring, IAM, Secret Manager, Artifact Registry" 11 $false $brandDark 'left' 'middle'
$r.TextFrame.MarginLeft = 14

# ============================================================================
# SLIDE 5 - Data Flow (Title + Body, numbered)
# ============================================================================
Add-ContentSlide -Title 'Data Flow' -Bullets @(
    'User logs in, picks the state and land type, and uploads the document bundle',
    'Files are saved to Cloud Storage and a new analysis record is created in Firestore',
    'Parser Agent reads each PDF and extracts the key facts',
    'Legal Agent and Fraud Agent run at the same time on those facts',
    'Findings are deduplicated and graded as Low, Medium, High or Critical',
    'Report Agent writes a short summary with clear next steps',
    'Backend streams progress live; frontend shows the final report',
    'Every step is logged and monitored in Google Cloud'
) | Out-Null

# ============================================================================
# SLIDE 6 - Flow Diagram (Title only + shape flow)
# ============================================================================
$s = Add-TitleOnlySlide 'Flow Diagram'

$row1Y = 120
$bw = 140; $bh = 56; $gap = 25
$xs = @(40, (40+$bw+$gap), (40+($bw+$gap)*2), (40+($bw+$gap)*3), (40+($bw+$gap)*4))
$nodes = @(
    @{label='User';        sub='Browser';                 fill=$tintBlue; line=0xE8D8C8; color=$brandPrimary},
    @{label='Frontend';    sub='Next.js on Cloud Run';    fill=$tintBlue; line=0xE8D8C8; color=$brandPrimary},
    @{label='Backend';     sub='FastAPI on Cloud Run';    fill=$tintBlue; line=0xE8D8C8; color=$brandDark},
    @{label='Documents';   sub='Cloud Storage';           fill=$tintCyan; line=0xD4C8B8; color=$brandDark},
    @{label='Results';     sub='Firestore';               fill=$tintCyan; line=0xD4C8B8; color=$brandDark}
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
    $b = Add-Rect $s $ax $row2Y $awidth $aheight $tintGreen 0x6FB8DA 5
    Add-ShapeText $b "$a Agent`rGemini 2.5-flash" 11 $true $brandDark 'center' 'middle'
    $ax += $awidth + $agap
}

$consY = $row2Y + $aheight + 25
Add-Arrow $s 480 ($row2Y + $aheight) 480 $consY $slate | Out-Null
$b = Add-Rect $s 280 $consY 400 50 $tintViolet 0xDED5C8 5
Add-ShapeText $b "Combine and grade findings`rdeduplicate - severity: Low, Medium, High, Critical" 11 $true $brandDark 'center' 'middle'

$repY = $consY + 60
Add-Arrow $s 480 ($consY + 50) 480 $repY $slate | Out-Null
$b = Add-Rect $s 280 $repY 400 46 $tintBlue 0xE8D8C8 5
Add-ShapeText $b "Final report streamed live to the user`rproperty facts - findings - checklist - parties" 11 $true $brandPrimary 'center' 'middle'

# ============================================================================
# SLIDE 7 - Agent Design (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Agent Design' -Bullets @(
    'One orchestrator coordinates everything - each agent has only one job',
    'Parser runs first; Legal and Fraud run in parallel; Report runs last',
    'Every agent uses Gemini 2.5 Flash with its own focused prompt',
    'Agents talk to each other through a shared JSON schema',
    'Parser reads the PDFs directly - no separate OCR step needed',
    'Stateless design means any single agent can be retried without redoing the rest',
    'Today they run together for speed and lower cost',
    'Any one of them can later be split into its own Cloud Run service if we need to scale it'
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
    @('Orchestrator',          'Takes the bundle, runs the agents, streams progress, saves results.',                                                'FastAPI on Cloud Run + Firestore'),
    @('Parser Agent',          'Reads each PDF and pulls out parties, area, stamp duty, dates and registration details.',                             'Vertex AI Gemini 2.5-flash'),
    @('Legal Rules Agent',     'Checks the documents against Indian land law and flags any non-compliance.',                                          'Vertex AI Gemini 2.5-flash'),
    @('Fraud Detection Agent', 'Looks for red flags: name mismatches, broken ownership chain, missing signatures, undervaluation.',                   'Vertex AI Gemini 2.5-flash'),
    @('Report Agent',          'Combines all findings into a short summary, grades severity, suggests next steps.',                                   'Vertex AI Gemini 2.5-flash')
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
    'Frontend and backend both run on Cloud Run as Docker containers',
    'Push to GitHub triggers Cloud Build to build the images and deploy automatically',
    'Docker images are stored in Artifact Registry with vulnerability scanning on',
    'Secrets (API keys, Firebase credentials) live in Secret Manager and are loaded at startup',
    'Uploaded documents go to Cloud Storage with short-lived signed URLs',
    'Analysis results and the audit log are stored in Firestore',
    'Cloud Run auto-scales from zero, so we only pay for what we use',
    'Each service has its own least-privilege IAM service account',
    'Logs and metrics are centralised in Cloud Logging and Monitoring with alerts',
    'Every request is protected by Firebase Authentication'
) | Out-Null

# ============================================================================
# SLIDE 10 - Google Technology Stack (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'Google Technology Stack' -Bullets @(
    'Vertex AI Gemini 2.5 - the AI brain that powers every agent',
    'Cloud Run - serverless hosting for the backend and the frontend',
    'Cloud Storage - keeps the uploaded land documents',
    'Firestore - stores analysis results and audit history',
    'Firebase Authentication - secure login for every user',
    'Cloud Build - automatic build and deploy on every git push',
    'Artifact Registry - stores our Docker images',
    'Secret Manager - keeps API keys and credentials safe',
    'Cloud Logging and Monitoring - shows how the app is performing',
    'IAM - controls what each service is allowed to do'
) | Out-Null

# ============================================================================
# SLIDE 11 - How did we arrive at this solution? (Title + Body)
# ============================================================================
Add-ContentSlide -Title 'How did we arrive at this solution?' -Bullets @(
    'Land deals in India use 8 to 10 documents - most buyers cannot verify them on their own',
    'Lawyers help, but are slow and expensive - and fraud patterns are hard to spot manually',
    'Gemini can read multi-page PDFs directly, which removes the need for any separate OCR step',
    'Splitting the job across small focused agents gave us better accuracy than one giant prompt',
    'Running the agents in parallel keeps the user experience fast',
    'Google Cloud gives us everything in one place - AI, hosting, storage, login and security',
    'End result: a non-expert buyer gets a clear answer in under a minute, not weeks'
) | Out-Null

# ============================================================================
# SLIDE 12 - Thank You (Title slide layout, theme styles it)
# ============================================================================
$idx = $pres.Slides.Count + 1
$thanks = $pres.Slides.Add($idx, $LAY_TITLE_SLIDE)
Set-Title    $thanks 'Thank You'
Set-Subtitle $thanks 'Landshield - verify your land. Before you sign.'

# --- Apply a built-in Office theme for a polished, professional look --------
# Tries a short list of clean themes; first one found on this machine wins.
$themeApplied = $null
$themeRoots = @(
    "$env:ProgramFiles\Microsoft Office\root\Document Themes 16",
    "${env:ProgramFiles(x86)}\Microsoft Office\root\Document Themes 16",
    "$env:ProgramFiles\Microsoft Office\Document Themes 16",
    "$env:ProgramFiles\Microsoft Office\root\Document Themes 15",
    "${env:ProgramFiles(x86)}\Microsoft Office\root\Document Themes 15"
)
$themeCandidates = @('Gallery.thmx','Ion.thmx','Frame.thmx','Berlin.thmx','Facet.thmx','Wisp.thmx','Office Theme.thmx')
foreach ($root in $themeRoots) {
    if (-not (Test-Path $root)) { continue }
    foreach ($name in $themeCandidates) {
        $p = Join-Path $root $name
        if (Test-Path $p) {
            try { $pres.ApplyTheme($p); $themeApplied = $name; break } catch {}
        }
    }
    if ($themeApplied) { break }
}

# --- Save -------------------------------------------------------------------
if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
$pres.SaveAs($OutputPath, 24)  # ppSaveAsOpenXMLPresentation
$pres.Close()

try { $ppt.Quit() } catch {}
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

Write-Host ""
Write-Host "Deck saved: $OutputPath"
if ($themeApplied) { Write-Host "Theme applied: $themeApplied" }
else { Write-Host "No built-in theme found on this machine - open Design tab in PowerPoint to pick one." }
Write-Host "Slides: 12 - 16:9 - uses Title + Content placeholders (theme-friendly)"
Write-Host "Open in PowerPoint, then Design tab -> pick any theme to restyle instantly."


