# Generates Landshield-Deck.pptx via PowerPoint COM automation.
# 16:9 widescreen, properly aligned, 12 slides mirroring Sample.pptx structure.

param([string]$OutputPath = "$PSScriptRoot\Landshield-Deck.pptx")

$ErrorActionPreference = 'Stop'

$ppt = New-Object -ComObject PowerPoint.Application
# msoTrue = -1; required to drive PowerPoint via COM
$ppt.Visible = -1

$pres = $ppt.Presentations.Add()

# Force 16:9 widescreen (960 x 540 points)
$pres.PageSetup.SlideWidth  = 960
$pres.PageSetup.SlideHeight = 540

$layoutBlank = 12   # ppLayoutBlank

# Brand palette (PowerPoint COM uses BGR, so reverse the hex)
# Matches frontend MUI theme: primary #1a73e8, primary.dark #1765cc, success #1e8e3e
$brandPrimary = 0xE8731A   # #1A73E8  brand blue
$brandDark    = 0xCC6517   # #1765CC  primary dark - used for headers/logo
$brandGreen   = 0x3E8E1E   # #1E8E3E  success / agents
$brandAmber   = 0x0074E3   # #E37400  warning (kept for accent)
$slate        = 0x68635F   # #5F6368  text.secondary
$ink          = 0x242420   # #202124  text.primary
$ink2         = 0x43403C   # #3C4043
$bgLight      = 0xFAF9F8   # #F8F9FA  background.default
$tintBlue     = 0xFEE2EA   # very light blue tint
$tintGreen    = 0xEAF4E6   # very light green tint
$tintAmber    = 0xE0F7FE   # very light amber/teal tint

# ─── Helpers ────────────────────────────────────────────────────────────────
function Add-Slide {
    $idx = $pres.Slides.Count + 1
    $s = $pres.Slides.Add($idx, $layoutBlank)
    $s.FollowMasterBackground = 0   # msoFalse
    $s.DisplayMasterShapes = 0      # hide any master placeholders
    $s.Background.Fill.ForeColor.RGB = 0xFFFFFF
    return $s
}

function Add-Rect {
    param($slide, $x, $y, $w, $h, $fill, $line = $null, $shape = 1)
    $s = $slide.Shapes.AddShape($shape, $x, $y, $w, $h)
    $s.Fill.ForeColor.RGB = $fill
    if ($null -eq $line) { $s.Line.Visible = $false }
    else { $s.Line.ForeColor.RGB = $line; $s.Line.Weight = 0.75 }
    return $s
}

function Set-TextStyle {
    param($shape, [string]$text, $size = 14, $bold = $false, $color = 0x242420,
          $align = 'left', $vAnchor = 'top')
    $tf = $shape.TextFrame
    $tf.WordWrap        = $true
    $tf.AutoSize        = 0     # ppAutoSizeNone (we control size)
    $tf.MarginLeft      = 6
    $tf.MarginRight     = 6
    $tf.MarginTop       = 3
    $tf.MarginBottom    = 3
    switch ($vAnchor) {
        'top'    { $tf.VerticalAnchor = 1 }  # msoAnchorTop
        'middle' { $tf.VerticalAnchor = 3 }  # msoAnchorMiddle
        'bottom' { $tf.VerticalAnchor = 4 }  # msoAnchorBottom
    }
    $tr = $tf.TextRange
    $tr.Text            = [string]$text
    $tr.Font.Name       = 'Calibri'
    $tr.Font.Size       = $size
    $tr.Font.Bold       = $bold
    $tr.Font.Color.RGB  = $color
    switch ($align) {
        'left'   { $tr.ParagraphFormat.Alignment = 1 }
        'center' { $tr.ParagraphFormat.Alignment = 2 }
        'right'  { $tr.ParagraphFormat.Alignment = 3 }
    }
}

function Add-Text {
    param($slide, $x, $y, $w, $h, [string]$text, $size = 14, $bold = $false,
          $color = 0x242420, $align = 'left', $vAnchor = 'top')
    $s = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
    Set-TextStyle -shape $s -text $text -size $size -bold $bold -color $color `
                  -align $align -vAnchor $vAnchor
    return $s
}

function Add-Arrow {
    param($slide, $x1, $y1, $x2, $y2, $color = 0x68635F)
    $s = $slide.Shapes.AddConnector(1, $x1, $y1, $x2, $y2)
    $s.Line.ForeColor.RGB    = $color
    $s.Line.Weight           = 1.25
    $s.Line.EndArrowheadStyle = 2
    return $s
}

# Page chrome (brand strip + title + subtitle), returns Y where content starts
function Add-PageHeader {
    param($slide, [string]$title, [string]$subtitle = '')
    Add-Rect $slide 0 0 960 6 $brandPrimary | Out-Null
    Add-Text $slide 40 22 880 36 $title 24 $true $brandDark | Out-Null
    if ($subtitle) {
        Add-Text $slide 40 58 880 22 $subtitle 12 $false $slate | Out-Null
        return 92
    }
    return 70
}

# Filled tile with a tinted band on the left + bold label + description
function Add-ListRow {
    param($slide, $x, $y, $w, $h, [string]$label, [string]$desc,
          $bandColor = $brandPrimary, $labelWidth = 230)
    Add-Rect $slide $x $y 4 $h $bandColor | Out-Null
    Add-Text $slide ($x + 14) $y ($labelWidth - 14) $h $label 12 $true $brandDark 'left' 'middle' | Out-Null
    Add-Text $slide ($x + $labelWidth + 6) $y ($w - $labelWidth - 6) $h $desc 11 $false $ink2 'left' 'middle' | Out-Null
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 1 - Cover
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$s.Background.Fill.ForeColor.RGB = $bgLight

Add-Rect $s 0 0 960 6 $brandPrimary | Out-Null

# Logo shield (rounded rect)
$shieldX = 410; $shieldY = 130; $shieldW = 64; $shieldH = 74
$shield = $s.Shapes.AddShape(5, $shieldX, $shieldY, $shieldW, $shieldH)
$shield.Fill.ForeColor.RGB = $brandDark
$shield.Line.Visible = $false
$lbox = Add-Text $s $shieldX $shieldY $shieldW $shieldH 'L' 36 $true 0xFFFFFF 'center' 'middle'
# Green check dot at corner
$dot = $s.Shapes.AddShape(9, ($shieldX + $shieldW - 16), ($shieldY - 8), 22, 22)
$dot.Fill.ForeColor.RGB = $brandGreen
$dot.Line.ForeColor.RGB = 0xFFFFFF
$dot.Line.Weight = 1.5

Add-Text $s 0 220 960 50 'Landshield' 44 $true $brandDark 'center' 'middle' | Out-Null
Add-Text $s 0 270 960 24 'AI-powered due diligence for Indian land documents' 16 $false $slate 'center' 'middle' | Out-Null

# Hackathon banner
$banner = Add-Rect $s 280 350 400 44 $brandPrimary $null 5
Set-TextStyle -shape $banner -text 'Infosys Gemini Hackathon 2026' -size 15 -bold $true -color 0xFFFFFF -align 'center' -vAnchor 'middle'

Add-Text $s 0 410 960 20 'AI Agents in Action' 12 $false $slate 'center' 'middle' | Out-Null
Add-Text $s 0 500 960 20 'Confidential - Team Submission - 2026' 10 $false $slate 'center' 'middle' | Out-Null

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 2 - Google Technology Stack
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Google Technology Stack' 'Everything Landshield runs on is native Google Cloud.'

$tech = @(
    @('Vertex AI Gemini 2.5',       'Multi-modal reasoning for parsing, legal analysis, fraud detection, and report synthesis.'),
    @('Cloud Run',                  'Serverless container hosting for the FastAPI backend and Next.js frontend. Auto-scales per request.'),
    @('Cloud Storage (GCS)',        'Signed-URL storage for uploaded land documents (sale deeds, ECs, mutations).'),
    @('Firestore',                  'Document database for analysis state, bundles, findings, and audit trail.'),
    @('Firebase Authentication',    'Email/password and Google sign-in with secure tokens passed to the backend.'),
    @('Cloud Build',                'CI/CD: GitHub push triggers Docker build, image push, Cloud Run deploy.'),
    @('Artifact Registry',          'Container image storage for backend and frontend Docker images.'),
    @('Secret Manager',             'Stores Gemini API keys and Firebase admin credentials at rest.'),
    @('Cloud Logging and Monitoring', 'Centralised structured logs, latency metrics, and error alerting.'),
    @('Identity and Access Management', 'Least-privilege service accounts for Cloud Run, Firestore, and GCS.')
)

$rowH = 36; $gap = 4
$y = $y0 + 4
foreach ($it in $tech) {
    Add-ListRow $s 40 $y 880 $rowH $it[0] $it[1] $brandPrimary 240
    $y += ($rowH + $gap)
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 3 - How did we arrive at this solution?
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'How did we arrive at this solution?'

$sections = @(
    @('Problem we observed', @(
        'Indian land transactions involve 8-10 documents per deal (sale deed, EC, mutation, tax receipt, building plan).',
        'Buyers cannot verify them alone; lawyers are expensive and slow.',
        'Fraud patterns (Roshni Act, tribal land sales, benami) are hard to spot manually.'
    )),
    @('Why an AI agent', @(
        'Gemini 2.5 reads multi-page PDFs natively and extracts structured fields with high accuracy.',
        'A multi-agent layout runs parser, legal, fraud, and report agents in parallel with focused prompts.',
        'Findings are consolidated and graded, so the user gets a lawyer-style summary, not raw text.'
    )),
    @('Why Google Cloud', @(
        'Vertex AI Gemini gives best-in-class multimodal reasoning without managing models ourselves.',
        'Cloud Run + Firestore scales from one document to thousands without infra work.',
        'Firebase Auth + IAM gives a clean security boundary for sensitive land data.'
    ))
)

$y = $y0
foreach ($sec in $sections) {
    Add-Rect $s 40 $y 880 26 $brandDark | Out-Null
    Add-Text $s 50 $y 860 26 $sec[0] 13 $true 0xFFFFFF 'left' 'middle' | Out-Null
    $y += 30
    foreach ($b in $sec[1]) {
        Add-Text $s 56 $y 880 22 ('-  ' + $b) 11 $false $ink2 'left' 'middle' | Out-Null
        $y += 24
    }
    $y += 8
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 4 - Thank you
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$s.Background.Fill.ForeColor.RGB = $brandDark
Add-Text $s 0 200 960 80 'Thank you' 56 $true 0xFFFFFF 'center' 'middle' | Out-Null
Add-Text $s 0 290 960 30 'Landshield - verify your land. Before you sign.' 16 $false 0xCFD8E0 'center' 'middle' | Out-Null

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 5 - Team and Use Case
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Team and use case'

# Team table (fixed columns)
$cols = @(
    @{x=40;  w=190; h='TEAM NAME'},
    @{x=230; w=240; h='MEMBER'},
    @{x=470; w=320; h='EMAIL ID'},
    @{x=790; w=130; h='DU'}
)
$headerY = $y0
Add-Rect $s 40 $headerY 880 28 $brandDark | Out-Null
foreach ($c in $cols) {
    Add-Text $s $c.x $headerY $c.w 28 $c.h 10 $true 0xFFFFFF 'left' 'middle' | Out-Null
}
$rowY = $headerY + 28
$rows = @(
    @('Landshield', 'Abhishek Partap S', 'abhishek.partap@example.com', 'AI Altitude')
)
foreach ($r in $rows) {
    Add-Rect $s 40 $rowY 880 30 0xFAFAFA 0xE0E0E0 | Out-Null
    Add-Text $s 40  $rowY 190 30 $r[0] 11 $false $ink 'left' 'middle' | Out-Null
    Add-Text $s 230 $rowY 240 30 $r[1] 11 $false $ink 'left' 'middle' | Out-Null
    Add-Text $s 470 $rowY 320 30 $r[2] 11 $false $ink 'left' 'middle' | Out-Null
    Add-Text $s 790 $rowY 130 30 $r[3] 11 $false $ink 'left' 'middle' | Out-Null
    $rowY += 32
}

# Use-case block
$ucY = $rowY + 12
Add-Text $s 40 $ucY 880 24 'Use case details' 16 $true $brandDark | Out-Null
$ucY += 28

$useCase = @(
    @('Use case',    'Landshield - AI-powered land document verification for Indian buyers.'),
    @('Domain',      'Real Estate / Legal Tech.'),
    @('Sub-domain',  'Document verification, fraud detection, due-diligence assistance.'),
    @('Description', 'A Gen AI agent system that ingests a bundle of land documents (sale deed, EC, mutation, tax receipt, building plan), extracts structured data, validates against Indian land laws (TPA, Roshni Act, tribal-land rules, RERA), flags fraud indicators (name mismatch, chain-of-title gaps, undervaluation), and produces a lawyer-style report graded by severity.'),
    @('Outcome',     'Buyer gets a clear go / clarify / stop verdict in seconds instead of weeks of manual due diligence.')
)
foreach ($r in $useCase) {
    $h = 28
    if ($r[1].Length -gt 100) { $h = 56 }
    if ($r[1].Length -gt 200) { $h = 70 }
    Add-Rect $s 40 $ucY 4 $h $brandPrimary | Out-Null
    Add-Text $s 54  $ucY 130 $h $r[0] 11 $true $brandDark 'left' 'top' | Out-Null
    Add-Text $s 190 $ucY 730 $h $r[1] 10 $false $ink2 'left' 'top' | Out-Null
    $ucY += $h + 4
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 6 - Solution Design
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Solution design' 'Component-by-component breakdown of what each service does.'

$design = @(
    @('Orchestrator (FastAPI / Cloud Run)', 'Receives the bundle, fans out parallel agent calls, streams progress via SSE, persists findings to Firestore.'),
    @('Parser Agent (Gemini)',               'Reads PDFs natively. Extracts parties, area, stamp duty, registration details, chain of title, dates.'),
    @('Legal Rules Agent (Gemini)',          'Maps extracted data against Indian land law: registration, stamp duty, state restrictions, RERA.'),
    @('Fraud Detection Agent (Gemini)',      'Flags name mismatches, chain-of-title gaps, undervaluation, fake registration patterns.'),
    @('Report Agent (Gemini)',               'Consolidates findings into a lawyer-style summary with severity grading and recommendations.'),
    @('Storage (GCS + Firestore)',           'GCS holds source PDFs (signed URLs). Firestore holds analysis state, findings, audit log.'),
    @('Frontend (Next.js / Cloud Run)',      'Dashboard, upload, real-time progress, report viewer. Firebase Auth gates access.'),
    @('Observability',                       'Cloud Logging + Cloud Monitoring: structured logs, agent latency, model cost, alerts.')
)
$y = $y0 + 4
foreach ($it in $design) {
    Add-ListRow $s 40 $y 880 40 $it[0] $it[1] $brandPrimary 270
    $y += 44
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 7 - Solution Architecture (Diagram)
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Solution architecture' 'Layered view: presentation, orchestration, agents, data, observability.'

# Presentation
$py = $y0
$rect = Add-Rect $s 40 $py 880 50 0xFEE2EA 0xFAC8C8 5
Add-Text $s 50 $py 200 22 'PRESENTATION' 10 $true $brandPrimary 'left' 'top' | Out-Null
Add-Text $s 50 ($py + 22) 860 26 'Next.js frontend on Cloud Run - Firebase Auth - dashboard, upload, real-time progress, report viewer.' 11 $false $ink2 'left' 'top' | Out-Null

# Orchestration
$py = $y0 + 60
$rect = Add-Rect $s 40 $py 880 50 0xFEE2EA 0xFAC8C8 5
Add-Text $s 50 $py 220 22 'ORCHESTRATION' 10 $true $brandDark 'left' 'top' | Out-Null
Add-Text $s 50 ($py + 22) 860 26 'FastAPI orchestrator on Cloud Run - SSE streaming - fans out parallel agent calls - persists state to Firestore.' 11 $false $ink2 'left' 'top' | Out-Null

# Agents layer
$py = $y0 + 120
$rect = Add-Rect $s 40 $py 880 90 0xEAF4E6 0xC8E5BD 5
Add-Text $s 50 ($py + 6) 200 18 'AGENTS (GEMINI 2.5)' 10 $true $brandGreen 'left' 'top' | Out-Null
$ax = 60
$boxW = 200; $boxGap = 10
foreach ($a in @('Parser', 'Legal Rules', 'Fraud Detection', 'Report')) {
    $b = Add-Rect $s $ax ($py + 30) $boxW 50 0xFFFFFF 0xC8E5BD 5
    Add-Text $s $ax ($py + 32) $boxW 22 $a 12 $true $brandDark 'center' 'top' | Out-Null
    Add-Text $s $ax ($py + 54) $boxW 20 'Gemini 2.5-flash' 9 $false $slate 'center' 'top' | Out-Null
    $ax += $boxW + $boxGap
}

# Data
$py = $y0 + 220
$rect = Add-Rect $s 40 $py 420 50 0xE0F7FE 0x8BDDFA 5
Add-Text $s 50 $py 400 22 'DATA' 10 $true $brandDark 'left' 'top' | Out-Null
Add-Text $s 50 ($py + 22) 400 26 'GCS (PDFs, signed URLs) - Firestore (findings, audit log)' 11 $false $ink2 'left' 'top' | Out-Null

# Cross-cutting
$rect = Add-Rect $s 500 $py 420 50 0xE6E8FC 0xBDC7FA 5
Add-Text $s 510 $py 400 22 'CROSS-CUTTING' 10 $true $brandDark 'left' 'top' | Out-Null
Add-Text $s 510 ($py + 22) 400 26 'Cloud Logging - Monitoring - IAM - Secret Manager - Artifact Registry' 11 $false $ink2 'left' 'top' | Out-Null

# Vertical arrows down the centre
Add-Arrow $s 480 ($y0 + 50)  480 ($y0 + 60)  $slate | Out-Null
Add-Arrow $s 480 ($y0 + 110) 480 ($y0 + 120) $slate | Out-Null
Add-Arrow $s 480 ($y0 + 210) 480 ($y0 + 220) $slate | Out-Null

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 8 - Data Flow (numbered list)
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Data flow' 'From upload to final report.'

$flow = @(
    'User uploads a bundle of land documents and selects state + land type.',
    'Frontend pushes files to backend; backend stores them in GCS and creates a Firestore record.',
    'Orchestrator triggers Parser Agent; Gemini reads each PDF and extracts structured fields.',
    'Legal Rules Agent and Fraud Detection Agent run in parallel on the extracted data.',
    'Findings are normalised, deduplicated, consolidated, and graded by severity.',
    'Report Agent generates a lawyer-style summary with severity counts and recommended actions.',
    'Backend persists the report to Firestore and streams progress to the frontend via SSE.',
    'User views the report: property facts, findings, checklist, parties, document inventory.',
    'Cloud Logging and Cloud Monitoring capture latency, errors, and cost throughout.'
)
$y = $y0 + 4
$i = 1
foreach ($step in $flow) {
    # Circular badge
    $b = $s.Shapes.AddShape(9, 50, $y, 30, 30)  # oval
    $b.Fill.ForeColor.RGB = $brandPrimary
    $b.Line.Visible = $false
    Set-TextStyle -shape $b -text "$i" -size 13 -bold $true -color 0xFFFFFF -align 'center' -vAnchor 'middle'
    Add-Text $s 92 $y 830 30 $step 12 $false $ink2 'left' 'middle' | Out-Null
    $y += 38
    $i++
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 9 - Flow Diagram (visual)
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Flow diagram' 'End-to-end request flow visualised.'

# Row 1: 5 boxes across the top
$row1Y = $y0 + 10
$bw = 140; $bh = 56; $gap = 25
$xs = @(40, (40+$bw+$gap), (40+($bw+$gap)*2), (40+($bw+$gap)*3), (40+($bw+$gap)*4))
$nodes = @(
    @{label='User'; sub='';                     fill=0xFEE2EA; line=0xFAC8C8; color=$brandPrimary},
    @{label='Next.js'; sub='Frontend / Cloud Run'; fill=0xFEE2EA; line=0xFAC8C8; color=$brandPrimary},
    @{label='Orchestrator'; sub='FastAPI / Cloud Run'; fill=0xFEE2EA; line=0xFAC8C8; color=$brandDark},
    @{label='GCS'; sub='PDFs (signed URL)'; fill=0xE0F7FE; line=0x8BDDFA; color=$brandDark},
    @{label='Firestore'; sub='Findings + audit'; fill=0xE0F7FE; line=0x8BDDFA; color=$brandDark}
)
for ($k = 0; $k -lt 5; $k++) {
    $n = $nodes[$k]
    Add-Rect $s $xs[$k] $row1Y $bw $bh $n.fill $n.line 5 | Out-Null
    Add-Text $s $xs[$k] ($row1Y + 8) $bw 22 $n.label 12 $true $n.color 'center' 'top' | Out-Null
    if ($n.sub) {
        Add-Text $s $xs[$k] ($row1Y + 30) $bw 22 $n.sub 9 $false $slate 'center' 'top' | Out-Null
    }
}
# Arrows between row 1 boxes
for ($k = 0; $k -lt 4; $k++) {
    $x1 = $xs[$k] + $bw
    $x2 = $xs[$k+1]
    Add-Arrow $s $x1 ($row1Y + $bh/2) $x2 ($row1Y + $bh/2) $slate | Out-Null
}

# Vertical arrow from orchestrator down to agents row
$orchX = $xs[2] + $bw/2
Add-Arrow $s $orchX ($row1Y + $bh) $orchX ($row1Y + $bh + 30) $slate | Out-Null

# Row 2: 4 agent boxes
$row2Y = $row1Y + $bh + 35
$awidth = 180; $aheight = 56; $agap = 20
$agentStart = (960 - ($awidth*4 + $agap*3)) / 2
$ax = $agentStart
foreach ($a in @('Parser','Legal','Fraud','Report')) {
    Add-Rect $s $ax $row2Y $awidth $aheight 0xEAF4E6 0xC8E5BD 5 | Out-Null
    Add-Text $s $ax ($row2Y + 8) $awidth 22 "$a Agent" 12 $true $brandDark 'center' 'top' | Out-Null
    Add-Text $s $ax ($row2Y + 30) $awidth 22 'Gemini 2.5-flash' 9 $false $slate 'center' 'top' | Out-Null
    $ax += $awidth + $agap
}

# Arrow down to consolidation
$consY = $row2Y + $aheight + 25
Add-Arrow $s 480 ($row2Y + $aheight) 480 $consY $slate | Out-Null

Add-Rect $s 280 $consY 400 50 0xE6E8FC 0xBDC7FA 5 | Out-Null
Add-Text $s 280 ($consY + 8) 400 22 'Consolidation + Severity Grading' 12 $true $brandDark 'center' 'top' | Out-Null
Add-Text $s 280 ($consY + 30) 400 20 'dedupe - combine related - grade low/medium/high/critical' 9 $false $slate 'center' 'top' | Out-Null

# Arrow down to report delivery
$repY = $consY + 60
Add-Arrow $s 480 ($consY + 50) 480 $repY $slate | Out-Null
Add-Rect $s 280 $repY 400 46 0xFEE2EA 0xFAC8C8 5 | Out-Null
Add-Text $s 280 ($repY + 6) 400 22 'Final Report streamed to Frontend (SSE)' 12 $true $brandPrimary 'center' 'top' | Out-Null
Add-Text $s 280 ($repY + 26) 400 20 'property facts - findings - checklist - parties' 9 $false $slate 'center' 'top' | Out-Null

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 10 - Agent Design
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Agent design' 'Four focused agents, orchestrated by a single controller.'

$ad = @(
    @('Orchestrator (Controller)', @(
        'Primary entry point - receives the bundle, validates, and coordinates the rest.',
        'Fans out parallel calls: Parser first, then Legal + Fraud in parallel, then Report.',
        'Streams progress via SSE. Persists state to Firestore at every step.'
    )),
    @('Specialised Gemini agents', @(
        'Each agent has its own focused system prompt and JSON output schema.',
        'Parser is multimodal (reads PDFs natively); the rest consume structured JSON.',
        'Stateless - exchange JSON, allowing easy retry and parallelism.'
    )),
    @('Agent communication', @(
        'In-process Python calls today (sub-second latency, lower cost).',
        'Designed so any agent can be promoted to its own Cloud Run service via HTTP/JSON.',
        'A shared ExtractedData schema keeps contracts stable across agents.'
    ))
)
$y = $y0
foreach ($sec in $ad) {
    Add-Rect $s 40 $y 880 26 $brandDark | Out-Null
    Add-Text $s 50 $y 860 26 $sec[0] 13 $true 0xFFFFFF 'left' 'middle' | Out-Null
    $y += 30
    foreach ($b in $sec[1]) {
        Add-Text $s 56 $y 880 22 ('-  ' + $b) 11 $false $ink2 'left' 'middle' | Out-Null
        $y += 24
    }
    $y += 8
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 11 - Agent Details (table)
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Agent details'

# Header
Add-Rect $s 40 $y0 880 30 $brandDark | Out-Null
Add-Text $s 50  $y0 180 30 'AGENT' 11 $true 0xFFFFFF 'left' 'middle' | Out-Null
Add-Text $s 230 $y0 460 30 'WHAT IT DOES' 11 $true 0xFFFFFF 'left' 'middle' | Out-Null
Add-Text $s 690 $y0 230 30 'GOOGLE SERVICE' 11 $true 0xFFFFFF 'left' 'middle' | Out-Null

$agents = @(
    @('Orchestrator',          'Receives the bundle, fans out parallel agent calls, streams progress, persists state.',                                         'FastAPI / Cloud Run + Firestore'),
    @('Parser Agent',          'Reads PDFs natively. Extracts parties, area, stamp duty, registration details, chain of title.',                                'Vertex AI Gemini 2.5-flash'),
    @('Legal Rules Agent',     'Maps extracted data against Indian land law. Flags only concrete document-specific issues.',                                    'Vertex AI Gemini 2.5-flash'),
    @('Fraud Detection Agent', 'Detects name mismatches, chain-of-title gaps, undervaluation. Consolidates related observations into single findings.',         'Vertex AI Gemini 2.5-flash'),
    @('Report Agent',          'Synthesises findings into a lawyer-style summary, grades severity, and recommends next steps.',                                 'Vertex AI Gemini 2.5-flash')
)

$y = $y0 + 32
foreach ($a in $agents) {
    Add-Rect $s 40 $y 880 56 0xFAFAFA 0xE0E0E0 | Out-Null
    Add-Text $s 50  $y 180 56 $a[0] 11 $true $brandDark 'left' 'middle' | Out-Null
    Add-Text $s 230 $y 460 56 $a[1] 10 $false $ink2 'left' 'middle' | Out-Null
    Add-Text $s 690 $y 230 56 $a[2] 10 $false $brandPrimary 'left' 'middle' | Out-Null
    $y += 60
}

# ═════════════════════════════════════════════════════════════════════════════
# SLIDE 12 - Deployment
# ═════════════════════════════════════════════════════════════════════════════
$s = Add-Slide
$y0 = Add-PageHeader $s 'Deployment' 'How Landshield ships to production.'

$deploy = @(
    @('Frontend (Next.js)',     'Containerised with Docker - deployed to Cloud Run - custom domain - CDN-cached static assets.'),
    @('Backend (FastAPI)',      'Containerised with Docker - deployed to Cloud Run - auto-scales 0 to N - tuned for Gemini latency.'),
    @('CI/CD',                  'GitHub push to main -> Cloud Build -> builds both images -> Artifact Registry -> deploys to Cloud Run.'),
    @('Artifact Registry',      'Stores backend + frontend Docker images. Vulnerability scanning enabled.'),
    @('Secret Manager',         'Holds Gemini API keys and Firebase admin credentials. Cloud Run reads at startup via service account.'),
    @('Cloud Storage (GCS)',    'Bucket for uploaded documents. Signed URLs with short TTL. Lifecycle rule to expire stale uploads.'),
    @('Firestore',              'Native-mode database. Stores analysis records, findings, audit log. Composite indexes per user + status.'),
    @('IAM',                    'Dedicated service account per Cloud Run service. Least-privilege grants on Firestore, GCS, Secret Manager.'),
    @('Logging and Monitoring', 'Structured JSON logs. Alert policies on error rate and Gemini latency. SLO: 95% of analyses < 90s.'),
    @('Firebase Auth',          'Email/password and Google sign-in. ID tokens passed to backend; verified server-side per request.')
)
$y = $y0 + 4
foreach ($it in $deploy) {
    Add-ListRow $s 40 $y 880 36 $it[0] $it[1] $brandPrimary 240
    $y += 40
}

# ─── Reorder slides to match Sample.pptx structure ──────────────────────────
# Current build order:
#  1 Cover, 2 Google Tech, 3 How-did-we, 4 Thank you,
#  5 Team, 6 Solution Design, 7 Architecture, 8 Data Flow,
#  9 Flow Diagram, 10 Agent Design, 11 Agent Details, 12 Deployment
# Target order (Sample):
#  1 Cover, 2 Team, 3 Solution Design, 4 Architecture, 5 Data Flow,
#  6 Flow Diagram, 7 Agent Design, 8 Agent Details, 9 Deployment,
#  10 Google Tech, 11 How-did-we, 12 Thank you
for ($t = 2; $t -le 9; $t++) {
    $pres.Slides.Item($t + 3).MoveTo($t)
}

# ─── Save ───────────────────────────────────────────────────────────────────
if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
$pres.SaveAs($OutputPath, 24)  # ppSaveAsOpenXMLPresentation
$pres.Close()

# Quit on next pump (the immediate Quit sometimes throws a benign COM event-handler error)
try { $ppt.Quit() } catch {}
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null

Write-Host ""
Write-Host "Deck saved: $OutputPath"
Write-Host "Slides: 12  -  size: 960 x 540 (16:9)"
