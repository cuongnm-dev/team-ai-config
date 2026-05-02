---
name: new-document-workspace
description: Tạo workspace mới để soạn tài liệu hành chính tiếng Việt theo 8 loại chuẩn của Nhà nước: Thiết kế Cơ sở, Thiết kế Chi tiết, Dự toán, Hồ sơ Mời thầu, Hồ sơ Dự thầu, Nghiên cứu Khả thi, Thuyết minh, Báo cáo Công trình. Mỗi loại có outline cố định, phỏng vấn riêng và viết song song nhiều agent.
---

# Skill: New Document Workspace (Claude Code Native)

**Hai chức năng: (1) Scaffold workspace mới, (2) Tạo document trong workspace có sẵn.**
**User gọi skill này cho TẤT CẢ tài liệu hành chính trừ Đề án CĐS (dùng /new-strategic-document).**

## § Render Routing (CRITICAL)

```
Doc type              Renderer       Output format
─────────────────     ──────────     ─────────────────────────
TKCS                  etc-platform     content-data.json → .docx
TKCT                  etc-platform     content-data.json → .docx
TKKT                  etc-platform   content-data.json → .docx
HDSD                  etc-platform   content-data.json → .docx
Test Cases            etc-platform   content-data.json → .xlsx
NCKT                  etc-platform   content-data.json → .docx (NĐ 45/2026 Đ12)
─────────────────     ──────────     ─────────────────────────
Dự toán               Pandoc         Markdown → .docx
HSMT                  Pandoc         Markdown → .docx
HSDT                  Pandoc         Markdown → .docx
Báo cáo chủ trương    Pandoc         Markdown → .docx
Thuyết minh           Pandoc         Markdown → .docx
```

**etc-platform doc types**: doc-writer produces structured JSON → merges into content-data.json → `etc-platform export` renders deterministic Office files. Tiết kiệm token, output chuẩn template.

**Pandoc doc types**: doc-writer produces Markdown prose → Pandoc export. Không thay đổi so với pipeline cũ.

## § Routing Logic

Khi user invoke skill:

```
Đã có workspace (projects/ tồn tại)?
  ├─ CÓ  → skip Phase 1-5, nhảy tới § NEW DOCUMENT FLOW
  └─ CHƯA → chạy Phase 1-5 scaffold, rồi hỏi tạo doc luôn không
```

---

# PART A: SCAFFOLD WORKSPACE

## § Phase 1 — Pre-flight + Workspace Identity

Pre-flight check: pandoc, python, git.

```
1. Tên workspace:     [{folder-name}]
2. Đơn vị chủ trì:   [Trung tâm / Cục / Vụ / Phòng / Khác]
3. Bộ chủ quản:       [BXD / BCA / BTTTT / Khác]
```

## § Phase 2 — Scope + Type Selection

→ Read `ref-doc-types.md`.

```
A) Single document   — một tài liệu
B) Document group    — bộ tài liệu cho gói thầu / dự án
C) Từ Đề án CĐS     — kế thừa data từ strategic pipeline
```

**Nếu C** → hỏi path tới thinking-bundle/:
```
Path tới Đề án: [projects/{de-an-slug}/thinking-bundle/]
Chọn dự án:     [DA-01 / DA-02 / ... từ initiative-portfolio.md]
```
→ Auto-populate: tên, phạm vi, kinh phí, dedup decisions, policy refs.

**Nếu B** → group presets:
```
★ HSDT đầy đủ     — TKCS + TKCT + Dự toán + HSDT
◦ Tiền khả thi    — Báo cáo chủ trương + NCKT
◦ Đầu tư mới      — NCKT + TKCS + Dự toán
◦ Tùy chọn        — [multi-select]
```

## § Phase 3 — Feature Flags

| Feature | Options | Default |
|---|---|---|
| Ministry variant | BXD / BCA / Generic | Generic |
| Export format | DOCX / PDF / Both | DOCX |
| Snippet library | Full / Minimal / None | Full |

## § Phase 4 — Scaffold

→ Read `ref-workspace-config.md` cho config templates.

Report: `[N/12] {action}... ✓`

**[1/12] Git init**
```bash
git init && git config core.autocrlf false
```

**[2/12] Directory structure**
```
{workspace}/
├── _workspace.md              ← MASTER CONFIG (mọi agent đọc trước)
├── templates/
│   ├── outlines/              ← immutable outlines
│   ├── dcb-template.md
│   ├── doc-state-template.md
│   └── group-dcb-template.md  ← (if Scope B)
├── reference/
│   ├── legal/
│   ├── ministry/
│   ├── glossary/
│   └── snippets/
├── export/
│   ├── output/                ← generated DOCX/PDF
│   ├── reference-docs/
│   ├── filters/
│   └── defaults/
├── projects/                  ← active documents
└── README.md
```

**[3/12] `_workspace.md`** — Master Config
→ Read `ref-workspace-config.md`. Tạo với:
- Workspace identity (từ Phase 1)
- Doc types (từ Phase 2-3)
- Feature flags (từ Phase 3)
- Agent roster: doc-orchestrator (haiku), doc-writer (sonnet), doc-reviewer (sonnet)
- Operational config: parallel limits, context budgets, stall detection
- Auto-continuation protocol
- Wave cycle flow
- File isolation contract
- Automation mode (default: REVIEW)

**[4/12] Copy outlines** (IMMUTABLE)

**Source selection** (Phase 2 of MCP migration):
- **Default (legacy)**: từ skill `outlines/` dir.
- **Opt-in MCP mode** (`--use-mcp` flag OR `ETC_USE_MCP=1`): dùng `mcp__etc-platform__outline_load(doc_type=..., version=...)` — server-managed canonical outlines, versioned theo legal basis.

Mapping doc_type ↔ legacy filename:
| doc_type | version | Legacy file |
|---|---|---|
| `tkcs` | `nd73-2019` | `tkcs-nd73-2019.md` |
| `tkct` | `nd73-2019` | `tkct-nd73-2019.md` |
| `du-toan` | `tt04-2020` | `du-toan-tt04-2020.md` |
| `hsmt` | `ldt2023` | `hsmt-ldt2023.md` |
| `hsdt` | `ldt2023` | `hsdt-ldt2023.md` |
| `nghien-cuu-kha-thi` | `nd45-2026` | `nghien-cuu-kha-thi.md` (19 chương + Phụ lục — render qua etc-platform) |
| `thuyet-minh` | `v1` | `thuyet-minh.md` |
| `bao-cao-chu-truong` | `v1` | `bao-cao-chu-truong.md` |

Future NĐ 45/2026 outlines sẽ thêm version `nd45-2026` cho `tkcs`/`tkct`/`du-toan` — same call shape, no skill change needed.

Chỉ copy doc types đã chọn vào `{workspace}/outlines/{doc-type}.md`. Content phải byte-identical với source (verify via `sha256` field returned).

**[5/12] Templates**
→ Read `ref-templates.md`. Tạo:
- `templates/dcb-template.md`
- `templates/doc-state-template.md`
- `templates/group-dcb-template.md` (if Scope B)

**[6/12] Legal reference files**
→ Read `ref-legal-framework.md`. Tạo summaries cho selected doc-types only.

**[7/12] Ministry variant** (skip if Generic)
→ Read `ref-ministry-variants.md`.

**[8/12] Snippets**
→ Read `ref-snippets.md`. Level: Full / Minimal / None (từ Phase 3).

**[9/12] Export setup**
→ Read `ref-export.md`. Tạo TẤT CẢ files sau (copy content từ ref-export.md):
- `export/defaults/vn-gov.yaml`
- `export/filters/vn-gov-format.lua`
- `export/export.ps1`
- `export/create-reference-docx.py`   ← TẠO MỚI: script python-docx
- `export/post-process.py`             ← TẠO MỚI: fix font/table sau Pandoc
- `export/reference-docs/` (thư mục rỗng — create-reference-docx.py sẽ tạo .docx)

Sau khi scaffold xong, auto-run:
```bash
python export/create-reference-docx.py
```
→ Tạo `export/reference-docs/nd30-2020-template.docx` ngay
→ Nếu python-docx chưa cài → pip install python-docx trước

**[10/12] Knowledge Base link** (if source = Đề án CĐS)
Nếu Scope C: tạo symlink hoặc copy `knowledge-base/` từ Đề án workspace.
→ doc-writer có thể truy cập dedup decisions + ecosystem data.

**[11/12] README.md**
Workspace purpose, doc types, quick start, export command.

**[12/12] Git commit**
```bash
git add . && git commit -m "chore: scaffold document workspace
Scope: {scope} | Types: {list} | Ministry: {ministry}"
```

## § Phase 5 — Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ {workspace} — ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tạo tài liệu: tiếp tục bên dưới hoặc gọi lại skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

→ Hỏi: "Tạo tài liệu ngay? (yes / no)"
→ If yes → § NEW DOCUMENT FLOW

---

# PART B: NEW DOCUMENT FLOW

## § Step 1 — Chọn loại tài liệu

Nếu chưa chọn (standalone invoke):
```
Loại tài liệu:
  1. Thiết kế sơ bộ (TKCS)         — NĐ 45/2026/NĐ-CP
  2. Thiết kế chi tiết (TKCT)      — NĐ 45/2026/NĐ-CP
  3. Dự toán phần mềm              — TT 04/2020/TT-BTTTT
  4. Báo cáo chủ trương đầu tư     — Luật số 58/2024/QH15
  5. Thuyết minh đề án / dự án     — NĐ 45/2026/NĐ-CP
  6. Hồ sơ mời thầu (HSMT)         — Luật số 22/2023/QH15
  7. Hồ sơ dự thầu (HSDT)          — Luật số 22/2023/QH15
  8. Báo cáo nghiên cứu khả thi    — NĐ 45/2026/NĐ-CP
```

## § Step 2 — DOC-TYPE-SPECIFIC Interview

**→ Đọc `ref-interview-questions.md` để chạy interview đúng loại tài liệu.**

Nguyên tắc:
- Interview phải: specific, prerequisite-aware, gate-blocking, VALIDATED
- Yêu cầu DATA THẬT: số liệu, tên hệ thống, tên đơn vị — không nhận câu mơ hồ
- Câu trả lời vague → follow-up ngay (xem quy tắc trong ref-interview-questions.md)

```
Bước thực hiện:
1. Đọc ref-interview-questions.md → mục Interview cho doc type đã chọn
2. Chạy interview theo câu hỏi trong file đó (prerequisite check trước)
3. Sau interview → chạy Post-Interview Validation (cuối ref-interview-questions.md)
4. Nếu PASS → tiếp tục § Step 3
5. Nếu FAIL prerequisite HARD → GATE BLOCK, giải thích cho user
```

## § Step 3 — Kế thừa data (nếu có)

**Từ Đề án CĐS** (Scope C):
```python
# Đọc initiative-portfolio.md → lấy info dự án
# Đọc dedup-report.md → lấy dedup decisions
# Đọc policy-landscape.md → lấy legal refs
# Auto-fill DCB với data kế thừa
```

**Từ document group** (TKCS → TKCT):
```python
# Đọc TKCS _doc_state.md → kiến trúc, module list
# Đọc TKCS dcb.md → project context
# Inject vào TKCT DCB như dependencies
```

## § Step 4 — Create Project + Init

**For etc-platform doc types (TKCS, TKCT, TKKT, HDSD):**
```
projects/{slug}/
├── _doc_state.md          ← from template, populated with section tracker
├── dcb.md                 ← from template, filled with interview + inherited data
├── content-data.json      ← etc-platform data contract (skeleton from interview)
└── output/                ← etc-platform renders here
```

Init `content-data.json` skeleton from interview data:
```python
# Use etc-platform MCP tools:
# 1. section_schema({doc_type}) → get field definitions
# 2. field_map({doc_type}) → get interview→field mapping
# 3. Pre-fill shared fields (project, meta, overview) from interview
# 4. Write skeleton to content-data.json
# 5. validate(content-data.json) → check initial skeleton
```

**For Pandoc doc types (Dự toán, HSMT, HSDT, etc. — không bao gồm NCKT):**
```
projects/{slug}/
├── _doc_state.md          ← from template, populated with section tracker
├── dcb.md                 ← from template, filled with interview + inherited data
└── content/
    ├── 00-bia.md          ← cover page
    ├── 01-muc-luc.md      ← TOC placeholder
    ├── 02-section-01.md   ← per outline section
    └── ...
```

## § Step 5 — Write (doc-orchestrator)

### 5a. etc-platform doc types (TKCS, TKCT, TKKT, HDSD)

**doc-writer output = structured JSON, NOT Markdown prose.**

```
doc-orchestrator:
  1. Gọi etc-platform MCP: section_schema({doc_type}) + field_map({doc_type})
  2. Plan waves based on field dependencies (NOT outline sections)
  3. Per wave:
     Dispatch doc-writer (parallel, Agent tool, background):
       - doc_type, target fields for this wave
       - dcb_excerpt (relevant only)
       - section_schema (field definitions)
       - field_map (interview → field mapping)
       - inherited data (nếu có từ TKCS/Đề án)
       
       doc-writer produces JSON matching section_schema:
       {
         "tkcs": {
           "legal_basis": "Căn cứ Nghị định số 45/2026/NĐ-CP...",
           "necessity": "Sự cần thiết đầu tư..."
         }
       }
     
     Merge: etc-platform MCP merge_content(content-data.json, writer_output)
     Validate: etc-platform MCP validate(content-data.json)
     
     Dispatch doc-reviewer:
       - Check content quality, pháp lý, cross-refs
       - Review JSON structure matches schema
     
  4. Present to user:
     "[Wave {N}] ✓ {K} fields done | validate: {status}"
     "Góp ý? (ok / sửa field X / thêm info)"
```

**doc-writer prompt for etc-platform types:**
```
## Writer: {doc_type} — Wave {N}

Output format: JSON (NOT Markdown prose)
Target: content-data.json → etc-platform sẽ render .docx

### Fields to fill this wave:
{from section_schema + field_map}

### DCB Context:
{dcb_excerpt}

### Schema Reference:
{section_schema output — field names, types, descriptions}

### Field Mapping:
{field_map output — interview answer → field path}

### Instructions:
1. Produce VALID JSON matching the schema exactly
2. Prose fields: văn phong hành chính VN, vô nhân xưng, trang trọng
3. Structured fields (arrays): follow nested model schema precisely
4. Use [CẦN BỔ SUNG: describe] for unknown data — KHÔNG bịa
5. Return JSON object with ONLY the fields you are filling
```

### 5b. Pandoc doc types (Dự toán, HSMT, HSDT, etc. — không bao gồm NCKT)

**Unchanged — doc-writer produces Markdown prose:**

```
doc-orchestrator:
  1. Đọc outline → parse dependency graph → plan waves
  2. Per wave:
     Dispatch doc-writer (parallel, Agent tool, background):
       - section_id, title
       - dcb_excerpt (relevant only)
       - dependencies (prior sections summaries)
       - constraints (legal refs, page limit)
       - snippet refs (if applicable)
       - inherited data (nếu có từ TKCS/Đề án)
     
     Wait → Collect → Merge vào content files
     
     Dispatch doc-reviewer:
       - Check content, NĐ 30, legal, cross-refs
     
     Auto-export draft DOCX
     
  3. Present to user:
     "[Wave {N}] ✓ {K} sections done | {file}.docx ready"
     "Góp ý? (ok / sửa section X / thêm info)"
```

## § Step 6 — Review + Export

### etc-platform doc types:
```
# Final review
Agent("doc-reviewer"):
  "FINAL review content-data.json.
   Nội dung, pháp lý, cross-ref, nhất quán.
   Kiểm tra: etc-platform MCP validate(content-data.json)"

# Final export via etc-platform v2.0.0 (job-based — bytes never enter LLM context)
ETC_URL = $ETC_PLATFORM_URL or "http://localhost:8001"

# 1) Upload content-data (out-of-band, 0 LLM tokens)
Bash(f"curl -fsS -X POST {ETC_URL}/uploads -F file=@projects/{slug}/content-data.json -F label={slug}")
# → returns upload_id

# 2) Submit render job (small MCP call, ~30 tokens)
mcp__etc-platform__export_async(upload_id=<id>, targets=["{doc_type}"])  # tkcs | tkct | tkkt | hdsd

# 3) Poll job_status until terminal, then download each output via curl
mcp__etc-platform__job_status(job_id=<id>)
Bash(f"curl -fsS -o projects/{slug}/output/<filename> {ETC_URL}/jobs/<id>/files/<filename>")
```

### Pandoc doc types:
```
# Final review
Agent("doc-reviewer"):
  "FINAL review toàn bộ.
   Nội dung, thể thức NĐ 30, pháp lý, cross-ref, nhất quán."

# Final export
Bash("./export/export.ps1 -DocPath projects/{slug} -Open")
```

## § Step 7 — Summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ {doc-type}: {project-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Renderer:  {etc-platform | Pandoc}
  Sections:  {N} | Words: {M} | Pages: ~{P}
  Placeholders remaining: {K}
  
  Output: projects/{slug}/output/{name}.docx  (etc-platform)
      OR: projects/{slug}/export/{name}.docx  (Pandoc)

  Tài liệu tiếp theo trong chuỗi:
    {gợi ý based on doc dependencies}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Document Dependencies (handoff chain)

```
Đề án CĐS → per DA-XX:
  ├── Báo cáo chủ trương (prerequisite: QĐ phê duyệt Đề án)        [Pandoc]
  ├── NCKT (prerequisite: Báo cáo CT hoặc QĐ chủ trương)           [etc-platform]
  ├── TKCS (prerequisite: NCKT hoặc QĐ đầu tư)                     [etc-platform]
  ├── TKCT (prerequisite: TKCS duyệt)                               [etc-platform]
  ├── Dự toán (prerequisite: TKCS hoặc TKCT)                        [Pandoc]
  ├── HSMT (prerequisite: QĐ kế hoạch lựa chọn nhà thầu)           [Pandoc]
  └── HSDT (prerequisite: HSMT + TKCS + Dự toán)                    [Pandoc]
```

Mỗi doc downstream **kế thừa** data từ doc upstream qua DCB injection.
User không cần copy-paste — orchestrator tự link.

**Cross-renderer handoff**: Khi TKCS (etc-platform) → Dự toán (Pandoc), orchestrator
đọc content-data.json và inject relevant data vào DCB cho Pandoc writer.
Khi NCKT → TKCS (cả hai etc-platform), orchestrator đọc `nckt.sections[]` từ
content-data.json và inject vào `tkcs.*` skeleton (kế thừa hiện trạng + giải pháp).

---

## § etc-platform MCP Tool Reference

Các MCP tools có sẵn khi etc-platform MCP server đang chạy:

| Tool | Mô tả | Khi nào dùng |
|---|---|---|
| `section_schema(doc_type)` | Schema cho 1 doc type (tiết kiệm token) | doc-writer cần biết fields |
| `field_map(doc_type)` | Interview → field mapping | doc-orchestrator plan waves |
| `merge_content(current_data, partial)` | Deep merge partial JSON (in-memory dict) | doc-writer ghi từng wave |
| `validate(content_data)` | Validate full dict (≤50KB) | Sau mỗi wave (small dict) |
| `validate_uploaded(upload_id)` | Validate uploaded payload | Stage 6 pre-export gate |
| `export_async(upload_id, targets)` | Submit async render job | Final export (replaces inline `export`) |
| `job_status(job_id)` | Poll job status + outputs[] | After `export_async` |
| `cancel_job(job_id)` | Cancel queued job | If user aborts |
| `upload_capacity()` | Runner stats | Optional pre-flight |
| `schema()` | Full JSON Schema | Khi cần toàn bộ schema |
| `template_list()` | Danh sách templates | Info |
| `template_fork(source, kind)` | Fork template mới | Template update |

**MCP Server khởi chạy:**
```bash
# stdio (IDE integration)
etc-platform mcp
# hoặc
python -m etc_platform.mcp_server
```
