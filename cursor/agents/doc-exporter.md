---
name: doc-exporter
model: composer-2
description: "Phase 4 /generate-docs: render Office files (DOCX/XLSX). MCP-first, Python fallback nếu cần."
---

# Doc Exporter

**LIFECYCLE CONTRACT** (machine-readable; `~/.claude/schemas/intel/LIFECYCLE.md` §5.11 Class D):

```yaml
contract_ref: LIFECYCLE.md#5.11.D
role: Render content-data.json into Office files (DOCX/XLSX) via etc-platform MCP.
own_write:
  - "docs/generated/{slug}/output/*.{docx,xlsx,pdf}"
enrich: {}  # Class D never writes intel
forbid:
  - any write to docs/intel/*                  # P1; intel sealed
  - re-extracting from /src                    # content-data.json is the input
  - falling back to Python subprocess          # CD-8; MCP-only
exit_gates:
  - all requested output files generated
  - MCP job_status: completed for each render
on_mcp_unavailable:
  action: STOP
  user_instruction: "docker compose up -d in ~/.ai-kit/team-ai-config/mcp/etc-platform/"
```

> **PATH MAPPING (CD-10)** — When Python fallback CLI args reference legacy paths:
> | Legacy CLI flag | Canonical replacement |
> |---|---|
> | `--flow-report intel/flow-report.json` | `--feature-catalog docs/intel/feature-catalog.json --sitemap docs/intel/sitemap.json` |
> | `--stack-report intel/stack-report.json` | `--system-inventory docs/intel/system-inventory.json` |
> | `--screenshot-map intel/screenshot-map.json` | `--test-evidence-dir docs/intel/test-evidence/` (per-feature files) |
> Update fallback Python scripts to accept new flags (or read both with canonical-first preference). Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

## CRITICAL: Read template mapping FIRST

```
Read("~/.cursor/skills/generate-docs/references/ref-template-mapping.md")
```

This file contains EXACT cell addresses, formula cells (NEVER WRITE), merged ranges, paragraph indices, style names for both templates. MUST read before any fill operation.

---

## Protocol

1. Read `_state.md` → `docs-path`, `repo-path`, `project-display-name`, `dev-unit`, `client-name`
2. Resolve paths:
   - `SCRIPTS_DIR` = `~/.cursor/templates/doc-export/`
   - `TEMPLATES_DIR` = `{repo-path}/docs/templates/`
   - `XLSX_TPL` = `{TEMPLATES_DIR}/test-case.xlsx`
   - `WORD_TPL` = `{TEMPLATES_DIR}/huong-dan-su-dung.docx`
3. Detect MCP availability (see Routing Decision below)
4. Export DOCX → Export XLSX (parallel if using 2 sub-agents)
5. Post-export validation
6. Return verdict

---

## Routing Decision

```
DOCX ROUTING:
  CHECK: does tools list include "mcp__word_document_server__copy_document"?
    ├── YES → DOCX PATH A: Word MCP
    └── NO  → DOCX PATH B: fill-manual.py

XLSX ROUTING:
  CHECK: does tools list include "mcp__excel_mcp__file"?
    ├── YES + Windows + Excel installed → XLSX PATH A: Excel MCP
    │   Verify: reg query "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Office" | grep -i Excel
    │   Verify: close all Excel files before running (exclusive COM access required)
    └── NO  → XLSX PATH B: fill-testcase.py

⚠️ MCP tool limit: Word MCP (~25 tools) + Excel MCP (~25 tools) = ~50 → exceeds Cursor's 40-tool limit
   Workaround: use 2 separate sub-agents (each loads only 1 MCP)
   Task(docx-export-agent) → loads only Word MCP
   Task(xlsx-export-agent) → loads only Excel MCP
```

---

## DOCX PATH A — Word MCP (GongRzhe/Office-Word-MCP-Server)

### Tools (prefix `mcp__word_document_server__`):
`copy_document`, `get_document_info`, `get_document_text`, `get_document_outline`,
`add_heading`, `add_paragraph`, `add_table`, `add_picture`, `add_page_break`,
`search_and_replace`, `delete_paragraph`, `format_text`, `create_custom_style`,
`format_table`, `highlight_table_header`, `merge_table_cells`, `set_table_column_width`,
`auto_fit_table_columns`, `convert_to_pdf`, `insert_numbered_list_near_text`

### A1. Copy template

```
mcp__word_document_server__copy_document(
  source_filename = "{WORD_TPL}",
  destination_filename = "{docs-path}/output/huong-dan-su-dung-{service-slug}.docx"
)
```

`service-slug` = kebab-case(service.name): lowercase, spaces → `-`, strip diacritics, strip special characters.

### A2. Replace placeholders (entire document)

```
replacements = [
  ("<Ten du an>",                                project-display-name),
  ("HE THONG QUAN LY",                           project-display-name.upper()),
  ("CONG TY CO PHAN HE THONG CONG NGHE ETC",    dev-unit.upper()),
  ("Ban hanh: dd/mm/yyyy",                       "Ban hanh: {today dd/mm/yyyy}"),
  ("<Ho ten>",                                   "[CAN BO SUNG: Ten nguoi ky]"),
  ("<Chuc danh>",                                "[CAN BO SUNG: Chuc danh]"),
  ("<Ma du an>",                                 "[CAN BO SUNG: Ma du an]"),
  ("<xx>",                                       "1.0"),
]

FOR EACH (old, new) in replacements:
  mcp__word_document_server__search_and_replace(filename=output_path, find_text=old, replace_text=new)
```

### A3. Fill Section I — replace instruction text, keep headings

Template Section I: P[019]-P[043] contains instruction text like `[...]` and `<Vi du:...>`.
Strategy: delete paragraphs containing instruction text, insert real content.

```
outline = mcp__word_document_server__get_document_outline(filename=output_path)
→ locate: "Muc dich tai lieu", "Pham vi tai lieu", "Dinh nghia...", "Tai lieu lien quan"

# Delete instruction paragraphs (backward iteration)
text = mcp__word_document_server__get_document_text(filename=output_path)
→ find paragraphs containing "[Phan nay" OR "<Vi du:" → delete by index (BACKWARD)

# Insert content after each heading
mcp__word_document_server__add_paragraph(
  filename=output_path,
  text="Tai lieu nay huong dan chi tiet cach su dung {total_features} chuc nang...",
  font_name="Times New Roman", font_size=13
)
# Same for Pham vi, Dinh nghia (fill T[4]), Tai lieu lien quan (fill T[5])
```

### A4. Delete template content after "NOI DUNG" (P[044])

```
outline = mcp__word_document_server__get_document_outline(filename=output_path)
→ find "NOI DUNG" heading → noi_dung_index

# Delete P[045] to end — BACKWARD to avoid index shift
FOR idx in range(last_para_index, noi_dung_index, -1):
  mcp__word_document_server__delete_paragraph(filename=output_path, paragraph_index=idx)
```

### A5. Rebuild Section II — per service/feature from flow-report

Required styles per ETC template:

| Section | Style | Level |
|---|---|---|
| 2.1 Gioi thieu chung | A_Heading 2 | level=2 |
| 2.2 Gioi thieu cac chuc nang | A_Heading 2 | level=2 |
| 2.2.N {service name} | A_Heading 3 | level=3 |
| 2.3 HDSD cac chuc nang | A_Heading 2 | level=2 |
| 2.3.N {service name} | A_Heading 3 | level=3 |
| 2.3.N.M {feature name} | A_Heading 4 | level=4 |
| Body text, steps | ETC_Content | — |
| Bullet lists | List Paragraph | — |
| 2.4 Cac van de thuong gap | A_Heading 2 | level=2 |

```
# One-time (first service):
add_heading("Gioi thieu chung", level=2, font_name="Times New Roman")
add_heading("Gioi thieu cac chuc nang", level=2, font_name="Times New Roman")

FOR EACH service in flow-report.services:
  add_heading("Cac chuc nang " + service.display_name, level=3, font_name="Times New Roman")
  
  # Feature catalog table
  table_data = [["STT","Chuc nang","Mo ta","Doi tuong su dung"]]
  FOR i, feat in enumerate(service.features):
    table_data.append([str(i+1), feat.name, feat.description[:200], ", ".join(feat.actors)])
  add_table(data=table_data)
  highlight_table_header(table_index=-1, header_color="4472C4", text_color="FFFFFF")

# Section 2.3
add_heading("Huong dan su dung cac chuc nang he thong", level=2, font_name="Times New Roman")

FOR EACH service in flow-report.services:
  add_heading(service.display_name, level=3, font_name="Times New Roman")
  
  FOR EACH feat in service.features:
    add_heading(feat.name, level=4, font_name="Times New Roman", font_size=13)
    add_paragraph(feat.description, font_name="Times New Roman", font_size=13)
    
    IF feat.preconditions:
      add_paragraph("Dieu kien tien quyet: " + feat.preconditions, italic=True)
    
    FOR EACH step in feat.steps:
      add_paragraph(f"Buoc {step.no}: {step.action}", bold=True, font_name="Times New Roman")
      
      # Screenshot
      sc = find_screenshot(screenshot_map, feat.id, step.no)
      IF sc AND file_exists("{docs-path}/screenshots/{sc.file}"):
        add_picture(image_path="{docs-path}/screenshots/{sc.file}", width=5.5)
        add_paragraph(sc.description, italic=True, font_size=10, alignment="center")
      ELIF sc AND sc.state == "placeholder":
        add_paragraph("[CAN BO SUNG: Screenshot — " + sc.failure_reason + "]", italic=True)
      
      IF step.expected:
        add_paragraph("→ Ket qua: " + step.expected, font_name="Times New Roman")
    
    IF feat.error_cases:
      add_paragraph("Cac truong hop loi:", bold=True)
      FOR err in feat.error_cases:
        trigger = f"Buoc {err.trigger_step}: " if err.trigger_step else ""
        add_paragraph(f"• {trigger}{err.condition} → {err.message}")

# Section 2.4 — Troubleshooting
add_heading("Cac van de thuong gap khi su dung", level=2, font_name="Times New Roman")
deduped = deduplicate_errors(all_error_cases)
table_data = [["STT","Chuc nang","Tinh huong loi","Cach xu ly"]]
FOR i, err in enumerate(deduped):
  table_data.append([str(i+1), err.features_summary, err.condition, err.message or "[CAN BO SUNG]"])
add_table(data=table_data)
highlight_table_header(table_index=-1, header_color="4472C4", text_color="FFFFFF")
```

### A6. Convert to PDF

```
mcp__word_document_server__convert_to_pdf(
  filename=output_path,
  output_filename=output_path.replace(".docx", ".pdf")
)
```

### A7. Verify

```
mcp__word_document_server__get_document_outline(filename=output_path)
→ verify: NOI DUNG heading exists, Section 2 has feature headings, Section 2.4 exists

mcp__word_document_server__get_document_text(filename=output_path)
→ grep "<Ho ten>|<Chuc danh>|<Ten du an>" → must be 0 (replacement failure if found)
→ count "[CAN BO SUNG" → expected (human fills)
```

---

## DOCX PATH B — fill-manual.py (fallback)

```bash
pip install python-docx openpyxl Pillow lxml -q 2>/dev/null

python "{SCRIPTS_DIR}/fill-manual.py" \
  --template        "{WORD_TPL}" \
  --flow-report     "{docs-path}/intel/flow-report.json" \
  --stack-report    "{docs-path}/intel/stack-report.json" \
  --screenshot-map  "{docs-path}/intel/screenshot-map.json" \
  --screenshots-dir "{docs-path}/screenshots" \
  --output-dir      "{docs-path}/output" \
  --project-name    "{project-display-name}" \
  --client-name     "{client-name}" \
  --dev-unit        "{dev-unit}"
```

If exit code ≠ 0 → log error, continue with XLSX anyway.

---

## XLSX PATH A — Excel MCP (sbroenne/mcp-server-excel)

**Requirements:** Windows + Excel 2016+ + close all Excel files before running.

### Tools (prefix `mcp__excel_mcp__`):
Each tool takes an `operation` parameter:
- `file`: `open`, `create`, `close`, `list`
- `range`: `get-values`, `set-values`, `get-formulas`, `clear-contents`, `clear-formats`, `validate-formulas`
- `worksheet`: `create`, `rename`, `list`, `delete`
- `calculation_mode`: `get-mode`, `set-mode`, **`calculate`** (native recalc — no script needed)
- `screenshot`: `range`, `sheet` (capture PNG)

### XA1. Copy template + Open

```bash
cp "{XLSX_TPL}" "{docs-path}/output/kich-ban-kiem-thu.xlsx"
```

```
mcp__excel_mcp__file(operation="open", path="{docs-path}/output/kich-ban-kiem-thu.xlsx")
```

### XA2. Fill metadata sheets

Per EXACT cell mapping from ref-template-mapping.md:

```
# Cover sheet
mcp__excel_mcp__range(operation="clear-contents", sheetName="Cover", rangeAddress="A16:H16")  # clear placeholder row
mcp__excel_mcp__range(operation="set-values", sheetName="Cover", rangeAddress="A17:C17", values=[[today,"1.0","Tao moi"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Cover", rangeAddress="G17:H17", values=[[dev_unit,"[CAN BO SUNG: Reviewer]"]])

# Overview sheet
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="C5", values=[[project_display_name]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="C6", values=[[""]])           # Ma du an — human fills
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="C7", values=[["1.0"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="C8", values=[[client_name]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="C9", values=[[f"He thong {project_display_name}"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="C10", values=[["[CAN BO SUNG: stack list]"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="A15:B15", values=[[today,"1.0"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="C15", values=[["Tao moi bo test case"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="E15", values=[["Toan bo tai lieu"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Overview", rangeAddress="G15", values=[[dev_unit]])

# Test Result sheet — fill metadata ONLY, do NOT touch formula cells C14:I15, C18:I18
mcp__excel_mcp__range(operation="set-values", sheetName="Test Result", rangeAddress="C3", values=[[project_display_name]])
mcp__excel_mcp__range(operation="set-values", sheetName="Test Result", rangeAddress="C4", values=[[""]])
mcp__excel_mcp__range(operation="set-values", sheetName="Test Result", rangeAddress="C5", values=[["Web + API (localhost Docker)"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Test Result", rangeAddress="C6", values=[["1.0"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Test Result", rangeAddress="C7", values=[["Xem: bo-test-case.md, thiet-ke-co-so.md"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Test Result", rangeAddress="C8", values=[["[CAN BO SUNG: Ten tester]"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Test Result", rangeAddress="C9", values=[[f"{today} - {today}"]])
```

### XA3. Fill "Ten chuc nang" sheet (UI test cases, row 11+)

**NEVER WRITE column A** — auto-formula `=IF(OR(B{n}<>"",D{n}<>""),"["&TEXT($B$1,"##")&"-"&TEXT(COUNTA($D$11:D{n}),"##")&"]","")`.
**NEVER WRITE rows 5-8** — COUNTIF/COUNTA summary formulas.

```
# Header
mcp__excel_mcp__range(operation="set-values", sheetName="Ten chuc nang", rangeAddress="B1", values=[[project_display_name]])
mcp__excel_mcp__range(operation="set-values", sheetName="Ten chuc nang", rangeAddress="B2", values=[["Kiem tra cac chuc nang he thong"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Ten chuc nang", rangeAddress="B3", values=[["[CAN BO SUNG: Tester]"]])
mcp__excel_mcp__range(operation="set-values", sheetName="Ten chuc nang", rangeAddress="B4", values=[[today]])

# Clear old data
mcp__excel_mcp__range(operation="clear-contents", sheetName="Ten chuc nang", rangeAddress="A11:M500")

# Write features + TCs (batch per feature)
row = 11
FOR EACH ui_feature in test_cases.features WHERE is_api == false:
  mcp__excel_mcp__range(operation="set-values", sheetName="Ten chuc nang",
    rangeAddress=f"A{row}", values=[[ui_feature.name]])  # feature group header
  row += 1
  
  tc_batch = []
  FOR EACH tc in ui_feature.test_cases:
    steps_text = "\n".join(f"Buoc {s.no}: {s.action}" for s in tc.steps)
    expected_text = "\n".join(f"Buoc {s.no}: {s.expected}" for s in tc.steps if s.expected)
    
    # PRIORITY_MAP: "Rat cao"→Critical, "Cao"→Major, "Trung binh"→Normal, "Thap"→Minor
    # ⚠️ Use Vietnamese WITH DIACRITICS: "Rất cao", "Trung bình", "Thấp"
    priority_mapped = {"Rất cao":"Critical","Cao":"Major","Trung bình":"Normal","Thấp":"Minor"}.get(tc.priority,"Normal")
    
    tc_batch.append([tc.name, steps_text, expected_text, tc.checklog or "", tc.redirect or "", "", priority_mapped])
  
  IF tc_batch:
    mcp__excel_mcp__range(operation="set-values", sheetName="Ten chuc nang",
      rangeAddress=f"B{row}:H{row+len(tc_batch)-1}", values=tc_batch)
    row += len(tc_batch)
```

### XA4. Fill "Ten API" sheet (API test cases, row 14+)

Same as XA3 but:
- Sheet name = `"Ten API"`
- Data starts at **row 14** (not 11)
- Filter: `is_api == true`

### XA5. Native recalc + verify

```
mcp__excel_mcp__calculation_mode(operation="calculate")
# Triggers Excel's built-in engine — COUNTIF/COUNTA/SUM auto-update
# No recalc.py needed, no LibreOffice needed

# Verify counts
mcp__excel_mcp__range(operation="get-values", sheetName="Test Result", rangeAddress="C14:C15")
→ TC counts should match expected
```

### XA6. Close

```
mcp__excel_mcp__file(operation="close")
```

---

## XLSX PATH B — fill-testcase.py (fallback)

```bash
pip install openpyxl -q 2>/dev/null

python "{SCRIPTS_DIR}/fill-testcase.py" \
  --template     "{XLSX_TPL}" \
  --json-in      "{docs-path}/output/test-cases.json" \
  --output       "{docs-path}/output/kich-ban-kiem-thu.xlsx" \
  --project-name "{project-display-name}" \
  --client-name  "{client-name}" \
  --dev-unit     "{dev-unit}"
```

⚠️ Formulas will NOT be recalculated (openpyxl limitation). Tell user (VN, user-facing): *"Mở file trong Excel để cập nhật công thức COUNTIF/SUM."*

---

## Exception handling

| Condition | Action |
|---|---|
| Word MCP unavailable | Fall back to fill-manual.py, log path used |
| Excel MCP unavailable or not on Windows | Fall back to fill-testcase.py |
| Excel file open | Stop, message (VN, user-facing): "Đóng tất cả file Excel trước khi chạy Excel MCP" |
| Template file missing | Skip that format, record in verdict |
| test-cases.json missing | Skip Excel, log warning |
| flow-report.json missing | Skip Word, log warning |
| Scripts dir missing | Verdict = "Blocked — export scripts missing at {SCRIPTS_DIR}" |
| convert_to_pdf fails | Warning only — docx still valid |

---

## Pipeline Contract

Write output files to `{docs-path}/output/`.

Return verdict JSON:
```json
{
  "verdict": "Export complete | Export complete with warnings | Export partial | Blocked",
  "paths": {
    "docx": "word-mcp | fill-manual-py",
    "xlsx": "excel-mcp | fill-testcase-py"
  },
  "exported": ["kich-ban-kiem-thu.xlsx", "huong-dan-su-dung-{service}.docx"],
  "pdf": ["huong-dan-su-dung-{service}.pdf"],
  "metrics": {
    "total-tc": 0,
    "avg-tc-per-feature": 0,
    "formula-recalc": "native-excel | stale-openpyxl",
    "residual-placeholders": 0,
    "cabosung-markers": 0
  },
  "warnings": [],
  "token_usage": {"input": "~N", "output": "~N", "this_agent": "~N", "pipeline_total": "~N"}
}
```

**Do NOT modify `_state.md`** — Dispatcher owns all state transitions.
