# ref-export.md — Pandoc Export Configuration

Scaffold creates files in `export/` directory.

---

## `defaults/vn-gov.yaml` — Pandoc Defaults

```yaml
# Pandoc defaults for Vietnamese government documents
# Usage: pandoc --defaults=export/defaults/vn-gov.yaml input.md -o output.docx

from: markdown+smart+pipe_tables+header_attributes+fenced_code_blocks+footnotes+tex_math_dollars
to: docx

# Reference doc — handles font, margins, page layout
reference-doc: export/reference-docs/nd30-2020-template.docx

# Lua filters
filters:
  - export/filters/vn-gov-format.lua

# Table of contents
toc: true
toc-depth: 3

# Metadata
metadata:
  lang: vi
  documentclass: report

# Variables
variables:
  margin-top: 20mm
  margin-bottom: 20mm
  margin-left: 30mm
  margin-right: 15mm
  fontsize: 13pt
  linestretch: 1.5
```

---

## `filters/vn-gov-format.lua` — Pandoc Lua Filter

```lua
-- vn-gov-format.lua
-- Pandoc Lua filter for Vietnamese government document formatting
-- Handles: page numbering, table/figure caption formatting, section breaks

-- Track table and figure counters per chapter
local chapter = 0
local table_counter = 0
local figure_counter = 0

-- Reset counters at each top-level heading
function Header(el)
  if el.level == 1 then
    chapter = chapter + 1
    table_counter = 0
    figure_counter = 0
  end
  return el
end

-- Format table captions: "Bảng X.Y: Title"
function Table(el)
  table_counter = table_counter + 1
  if el.caption and el.caption.long then
    local caption_text = pandoc.utils.stringify(el.caption.long)
    if not caption_text:match("^Bảng") then
      local prefix = string.format("Bảng %d.%d: ", chapter, table_counter)
      table.insert(el.caption.long, 1, pandoc.Plain(pandoc.Str(prefix)))
    end
  end
  return el
end

-- Format figure captions: "Hình X.Y: Title"
function Figure(el)
  figure_counter = figure_counter + 1
  if el.caption and el.caption.long then
    local caption_text = pandoc.utils.stringify(el.caption.long)
    if not caption_text:match("^Hình") then
      local prefix = string.format("Hình %d.%d: ", chapter, figure_counter)
      table.insert(el.caption.long, 1, pandoc.Plain(pandoc.Str(prefix)))
    end
  end
  return el
end

-- Convert \newpage to page breaks
function RawBlock(el)
  if el.text:match("\\newpage") then
    if FORMAT:match("docx") then
      return pandoc.RawBlock("openxml",
        '<w:p><w:r><w:br w:type="page"/></w:r></w:p>')
    end
  end
  return el
end

-- Vietnamese date formatting helper (for metadata)
function Meta(meta)
  if meta.date then
    local date_str = pandoc.utils.stringify(meta.date)
    -- Convert YYYY-MM-DD to Vietnamese format if needed
    local y, m, d = date_str:match("(%d%d%d%d)-(%d%d)-(%d%d)")
    if y then
      meta.date = pandoc.MetaInlines(pandoc.Str(
        string.format("ngày %s tháng %s năm %s", d, m, y)))
    end
  end
  return meta
end
```

---

## `export.ps1` — One-Command Export Script

```powershell
# Export script for Vietnamese government documents (NĐ 30/2020)
# Usage: ./export/export.ps1 -DocPath projects/{doc-slug} [-Open] [-Format pdf]

param(
    [Parameter(Mandatory=$true)]
    [string]$DocPath,
    
    [switch]$Open,
    
    [ValidateSet('docx','pdf')]
    [string]$Format = 'docx'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Get absolute paths
$basePath = Join-Path $PSScriptRoot ".."
$markdownDir = Join-Path $DocPath "content"
$exportDir = Join-Path $PSScriptRoot "output"
$template = Join-Path $PSScriptRoot "defaults\vn-gov.yaml"
$filter = Join-Path $PSScriptRoot "filters\vn-gov-format.lua"

# Check if Pandoc exists
try {
    $pandocVersion = pandoc --version | Select-String -Pattern "pandoc\s+([\d.]+)" | ForEach-Object { $_.Matches.Groups[1].Value }
    Write-Host "✓ Pandoc version: $pandocVersion"
} catch {
    Write-Host "❌ Pandoc not found. Please install Pandoc 3.0 or later." -ForegroundColor Red
    exit 1
}

# Check if directory exists
if (-not (Test-Path $markdownDir)) {
    Write-Host "❌ Content directory not found: $markdownDir" -ForegroundColor Red
    exit 1
}

# Create export directory
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null

# Get document name from project
$docName = Split-Path $DocPath -Leaf
$outputFile = Join-Path $exportDir "$docName.docx"
Write-Host "Exporting: $docName..."

# Resolve markdown files in deterministic order
$markdownFiles = Get-ChildItem -Path $markdownDir -Filter "*.md" | Sort-Object Name | ForEach-Object { $_.FullName }
if (-not $markdownFiles -or $markdownFiles.Count -eq 0) {
    Write-Host "❌ No markdown files found in: $markdownDir" -ForegroundColor Red
    exit 1
}

# Run Pandoc with Vietnamese government template
$pandocArgs = @(
    "-t", "docx",
    "-o", $outputFile,
    "-d", $template,
    "--lua-filter", $filter,
    "--from", "markdown+yaml_metadata_block+autolink_bare_uris+pipe_tables+tex_math_dollars"
)
$pandocArgs += $markdownFiles

Write-Host "Running Pandoc..." -ForegroundColor Cyan
& pandoc $pandocArgs 2>&1 | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Export failed." -ForegroundColor Red
    exit 1
}

# Check for placeholders
Write-Host "`nChecking for placeholders..." -ForegroundColor Cyan
$placeholderCount = Select-String -Path (Join-Path $markdownDir "*.md") -Pattern "{{content:|{{optional:|\[CẦN BỔ SUNG:|\<!-- DIAGR" | Measure-Object | Select-Object -ExpandProperty Count

if ($placeholderCount -gt 0) {
    Write-Host "⚠ Found $placeholderCount placeholders (unfilled content)" -ForegroundColor Yellow
    Write-Host "  Replace with actual content before final export."
} else {
    Write-Host "✓ All placeholders filled." -ForegroundColor Green
}

# Check for diagrams
$diagramDir = Join-Path $markdownDir "diagrams"
if (Test-Path $diagramDir) {
    $diagramCount = (Get-ChildItem -Path $diagramDir -Filter "*.png" | Measure-Object).Count
    Write-Host "✓ Diagrams found: $diagramCount PNG files" -ForegroundColor Green
}

# Open in Word if requested
if ($Open) {
    Write-Host "`nOpening in Word..." -ForegroundColor Cyan
    Start-Process $outputFile
}

Write-Host "`n✓ Export complete: $outputFile" -ForegroundColor Green
Write-Host "Next steps:"
Write-Host "  1. Open the DOCX in Microsoft Word"
Write-Host "  2. Press Ctrl+A, then F9 to update fields (Table of Contents, page numbers)"
Write-Host "  3. Review and save"
```

---

## Reference Doc Instructions

The scaffold creates a **placeholder** reference doc. User must provide actual `.docx` template:

```
export/reference-docs/
├── nd30-2020-template.docx    ← PLACEHOLDER — user provides
├── bxd-template.docx          ← PLACEHOLDER — only if ministry = BXD
└── bca-template.docx          ← PLACEHOLDER — only if ministry = BCA
```

**How to create a reference doc:**

1. Open Microsoft Word
2. Set page margins: Top 20mm, Bottom 20mm, Left 30mm, Right 15mm
3. Set default font: Times New Roman 13pt, line spacing 1.5
4. Define heading styles: Heading 1 (14pt bold), Heading 2 (13pt bold), Heading 3 (13pt bold italic)
5. Create header/footer with page numbering (center, bottom)
6. Save as `.docx`

**Or:** Convert an existing properly-formatted government document to use as reference.

Scaffold creates a minimal placeholder with instructions inside the doc.
