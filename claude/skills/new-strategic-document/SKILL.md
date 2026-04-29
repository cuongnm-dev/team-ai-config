---
name: new-strategic-document
description: "Tạo Đề án CĐS/CNTT bằng Strategic Thinking Pipeline. Research-centric, KB + DEDUP, 4 spirals, real parallel agents. Invoke khi user cần tạo đề án chiến lược CĐS cho cơ quan nhà nước."
---

# Skill: New Strategic Document (Claude Code Native)

**Research-driven pipeline: nghiên cứu xong mới viết. Giải pháp thực tiễn, không trùng lặp.**

## § KB + DEDUP source — centralized MCP (default Phase 3+) with local fallback

**Default**: KB và DEDUP query/save qua `etc-platform` MCP — team-wide shared registry per CT 34 §6.

| Operation | MCP tool | Replaces |
|---|---|---|
| KB read | `mcp__etc-platform__kb_query(domain=..., max_age_days=...)` | Local `knowledge-base/{domain}/*.md` scan |
| KB write | `mcp__etc-platform__kb_save(domain, title, body, ..., confidence)` | Local file write |
| DEDUP check | `mcp__etc-platform__dedup_check(proposal={problem, solution_summary})` | Per-project local registry |
| DEDUP record | `mcp__etc-platform__dedup_register(proposal, decision, rationale, ecosystem_ref)` | Local `dedup/decisions.md` append |

**Fallback** — when MCP unavailable OR `--no-mcp`/`ETC_USE_MCP=0`: read local `knowledge-base/` + per-project DEDUP file.

**Bootstrap** (one-time per server install): `docker exec -it etc-platform python scripts/bootstrap_kb_seeds.py` — populates 7 baseline entries (NDXP, LGSP, VNeID, CSDLQG-DC, CT 34, QĐ 749, NĐ 45/2026).

## § In-session task tracking — TodoWrite (mandatory)

This pipeline spans 4 spirals + 8 phases that may span multiple sessions. Use Claude Code's `TodoWrite` tool to track real-time progress within each session. State persists cross-session via `_strategy_state.md`; `TodoWrite` covers in-session live state.

**At Phase 0 start**, initialize:
```
TodoWrite([
  {content: "Phase 0 Pre-flight", status: "in_progress", activeForm: "Pre-flight"},
  {content: "Phase 1 Workspace + Project setup", status: "pending", activeForm: "Setting up"},
  {content: "Spiral 1 SCOPE", status: "pending", activeForm: "Spiral 1"},
  {content: "Spiral 2 STRATEGY", status: "pending", activeForm: "Spiral 2"},
  {content: "Spiral 3 SOLUTIONS + DEDUP", status: "pending", activeForm: "Spiral 3"},
  {content: "Spiral 4 STRUCTURE + Section Briefs", status: "pending", activeForm: "Spiral 4"},
  {content: "Phase 6 WRITE Layer", status: "pending", activeForm: "Writing"},
  {content: "Phase 7 Final Review + KB Update", status: "pending", activeForm: "Reviewing"},
  {content: "Phase 8 Summary + Handoff", status: "pending", activeForm: "Handoff"}
])
```

**At every spiral checkpoint** (e.g. after Spiral 1 complete + user approves), update:
```
TodoWrite update: mark "Spiral 1 SCOPE" completed, mark "Spiral 2 STRATEGY" in_progress
```

**Add new todos when discovered** (e.g. spiral-back, additional research). Don't batch — update immediately so user sees real-time progress.

## § Phase 0 — Pre-flight

```bash
pandoc --version    # ≥ 3.0
python --version    # ≥ 3.10
git config user.name
```

**KB freshness check** (MCP mode): `mcp__etc-platform__kb_query(domain="ecosystem", max_age_days=90)` → if empty/stale, prompt user to run bootstrap. **Local fallback**: kiểm tra `knowledge-base/`, seed từ `ref-kb-seed.md` nếu rỗng.

## § Phase 1 — Workspace + Project Setup

### 1a. Workspace (nếu chưa có)

Hỏi user:
```
1. Tên workspace:    [{folder-name}]
2. Đơn vị chủ trì:  [Trung tâm / Cục / Vụ / Sở / Viện / Khác]
3. Bộ chủ quản:      [BXD / BCA / BTTTT / BNV / Khác]
```

Scaffold: directory structure + KB seed + export config + outlines.
→ Read `ref-kb-seed.md`, `ref-export.md` để tạo.

### 1b. Project

```
4. Tên Đề án:        [...]
5. Đề án cho ai phê duyệt:  [Bộ trưởng / Thủ tướng / Chủ tịch tỉnh]
6. Thời hạn dự kiến: [3 năm / 5 năm / 10 năm]
```

Tạo project structure:
```
projects/{de-an-slug}/
├── _strategy_state.md
├── thinking-bundle/
│   └── (populated during spirals)
├── content/
│   └── (populated during WRITE layer)
└── export/
```

## § Phase 2 — Spiral 1: SCOPE

### Step 2a: Deep Context Interview (FOREGROUND — cần hỏi user)

**strategy-analyst chạy FOREGROUND** (không background — cần interactive):

```
Agent("strategy-analyst"):
  "Bạn đang bắt đầu Spiral 1: SCOPE cho Đề án CĐS.
   
   Đọc knowledge-base/ecosystem/ và knowledge-base/policy/ TRƯỚC.
   
   Sau đó dẫn dắt Deep Context Interview:
   Block 1 — Tổ chức: tên, cấp, chức năng, quy mô
   Block 2 — Hiện trạng CĐS: hệ thống, vấn đề, lịch sử CĐS
   
   Interview THÔNG MINH: skip câu đã rõ, follow-up khi cần.
   User có thể paste tài liệu thay vì trả lời.
   
   Output: ghi thinking-bundle/01-org-profile.md"
```

### Step 2b: Policy Research (BACKGROUND — song song với interview)

```
Agent("policy-researcher", run_in_background=true):
  "Scan policy landscape cho {bộ chủ quản}.
   Đọc knowledge-base/policy/_active-policies.md.
   Web search: cập nhật mới nhất.
   
   Output: ghi thinking-bundle/02-policy-landscape.md
   KB_WRITE: cập nhật nếu có findings mới."
```

→ Interview foreground + Research background = tối ưu thời gian.
→ Khi interview xong, check policy-researcher đã xong chưa → merge.

## § Phase 3 — Spiral 2: STRATEGY

```
Agent("strategy-analyst"):
  "Spiral 2: STRATEGY.
   Đọc: 01-org-profile.md + 02-policy-landscape.md
   Đọc KB: precedent/_patterns.md, policy/qd-749.md
   
   Interview user Block 3 (Tầm nhìn):
   - Kỳ vọng lãnh đạo? Ưu tiên?
   - Ngân sách khung? Thời gian?
   
   Perform Gap Analysis: Hiện trạng vs QĐ 749 vs Kỳ vọng.
   Design Strategic Framework: trụ cột + mục tiêu per trụ cột.
   
   Output:
   - thinking-bundle/04-gap-analysis.md
   - thinking-bundle/05-strategic-framework.md"
```

### 🔵 CHECKPOINT 1

**Format trình user:**
```
━━━ CHECKPOINT 1: Strategic Framework ━━━
Đã tạo: thinking-bundle/05-strategic-framework.md

Tóm tắt:
  Tầm nhìn: {1 câu}
  Trụ cột:
    1. {Tên trụ cột 1} — {mục tiêu}
    2. {Tên trụ cột 2} — {mục tiêu}
    ...
  Gap lớn nhất: {top 3}

→ Xem chi tiết: mở file 05-strategic-framework.md
→ Approve? (ok / sửa {chi tiết} / thêm trụ cột / bỏ trụ cột)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

User trả lời → if "ok" → Phase 4. If sửa → re-run strategy-analyst với feedback.

## § Phase 4 — Spiral 3: SOLUTIONS + DEDUP

### Step 4a: Interview constraints + Draft portfolio (FOREGROUND)

```
Agent("strategy-analyst"):
  "Spiral 3: SOLUTIONS.
   Đọc: all thinking artifacts + KB(ecosystem, tech)
   
   Interview user Block 4 (Ràng buộc):
   - Cấp phê duyệt? KPI từ cấp trên?
   - Ràng buộc đặc biệt? Mẫu tham khảo?
   
   Per trụ cột: đề xuất dự án/nhiệm vụ cụ thể.
   Cho TỪNG đề xuất: chạy DEDUP (đọc KB ecosystem).
   
   Output:
   - thinking-bundle/06-initiative-portfolio.md
   - thinking-bundle/07-dedup-report.md"
```

### Step 4b: Ecosystem deep-scan (BACKGROUND — song song)

```
Agent("policy-researcher", run_in_background=true):
  "Deep scan ecosystem cho {ministry} sector.
   Web search: dự án đang triển khai ở nơi khác.
   Cập nhật thinking-bundle/03-ecosystem-map.md.
   KB_WRITE: all new findings."
```

### 🔵 CHECKPOINT 2

```
━━━ CHECKPOINT 2: Initiative Portfolio (Deduped) ━━━
Đã tạo: 06-initiative-portfolio.md + 07-dedup-report.md

Tổng quan:
  Dự án/NV: {N} | Kinh phí sơ bộ: {X tỷ}
  Dedup: {Y} ADOPT + {Z} INTEG + {W} UNIQUE + {V} REJECT

Top 5 dự án:
  DA-01: {tên} — {verdict} — {kinh phí}
  DA-02: {tên} — {verdict} — {kinh phí}
  ...

→ Xem chi tiết: mở files trong thinking-bundle/
→ Approve? (ok / sửa DA-XX / thêm / bỏ / đổi ưu tiên)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## § Phase 5 — Spiral 4: STRUCTURE + SECTION BRIEFS

**2 agents PARALLEL:**

```
Agent("structure-advisor", run_in_background=true):
  "Đọc all thinking artifacts + KB precedent/_patterns.md.
   Đề xuất outline phù hợp cho {org level, budget, scope}.
   Tạo section dependency graph + wave plan.
   Output: thinking-bundle/08-approved-outline.md
           thinking-bundle/09-section-deps.md"

Agent("strategy-analyst", run_in_background=true):
  "Đọc 05-strategic-framework + 06-initiative-portfolio.
   Viết Section Brief cho MỖI section trong outline.
   Output: thinking-bundle/10-section-briefs/*.md"
```

→ Cả 2 chạy background (không cần user input).
→ Đợi xong → present to user.

### 🔵 CHECKPOINT 3

```
━━━ CHECKPOINT 3: Outline + Section Briefs ━━━
Đã tạo: 08-approved-outline.md + 10-section-briefs/

Outline ({N} sections, {M} trang dự kiến):
  1. Sự cần thiết... [CORE] 4 trang
  2. Thực trạng...   [CORE] 5 trang
  ...

Section Briefs: {K} briefs, all with key_arguments + evidence

→ Xem: mở files trong thinking-bundle/
→ Approve & FREEZE? (ok / sửa outline / sửa brief)

⚠ Sau khi FREEZE: outline LOCKED, không sửa cấu trúc nữa.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

User "ok" → **FREEZE Thinking Bundle** → tất cả files trong thinking-bundle/ đánh dấu frozen.

## § Phase 6 — WRITE Layer (chuyển tiếp sang doc pipeline)

**Transition THINK → WRITE:**

1. **Lock outline**: copy `08-approved-outline.md` → outline trở thành IMMUTABLE
2. **Generate DCB**: strategy-analyst condensed Thinking Bundle → `dcb.md` (≤ 3000 tokens)
   ```
   Agent("strategy-analyst"):
     "Đọc toàn bộ thinking-bundle/.
      Tạo dcb.md condensed: metadata + strategy summary + pillars + dedup decisions.
      Tối đa 3000 tokens. Đây là context cho doc-writers."
   ```
3. **Create content files**: từ locked outline → `content/{nn}-section-{id}.md`
4. **Init _doc_state.md**: section tracker từ outline

**⚠ Đề án CĐS = Pandoc pipeline** (không dùng etc-docgen — không có template Đề án).
Wave writing + export giữ nguyên: Markdown → Pandoc.

**Wave-based writing** (doc-orchestrator takes over):

```
Per wave (from 09-section-deps.md wave_plan):
  
  # Dispatch writers PARALLEL
  For section in wave.sections:
    Agent("doc-writer", run_in_background=true):
      "section_id: {id}
       section_title: {title}
       dcb_excerpt: {relevant from dcb.md}
       section_brief: {from 10-section-briefs/brief-{id}.md}
       dedup_results: {relevant from 07-dedup-report.md}
       policy_refs: {from section brief}
       
       Ghi vào: content/{nn}-section-{id}.md
       Trả summary: word_count, placeholders, cross_refs"
  
  # Wait → Collect
  
  # Review wave
  Agent("doc-reviewer"):
    "Review sections {list} Wave {N}.
     Check: content, NĐ 30, legal, cross-refs, strategic coherence."
  
  # Auto-export draft
  Bash("./export/export.ps1 -DocPath projects/{slug}")
  
  # Present to user (REVIEW mode)
  "[Wave {N}] ✓ {K} sections | Export: {slug}.docx | Góp ý? (ok | sửa section X)"
```

## § Phase 7 — Final Review + KB Update

```
Agent("doc-reviewer"):
  "FINAL review: toàn bộ document.
   Strategic checks:
   - Narrative flow (mạch lạc?)
   - Dedup compliance (CT 34 NTắc 6)
   - KPI alignment (QĐ 749)
   - Budget ↔ Portfolio khớp?"

# Final export
Bash("./export/export.ps1 -DocPath projects/{slug} -Open")

# Save precedent to KB
Agent("policy-researcher", run_in_background=true):
  "Lưu Đề án này vào knowledge-base/precedent/{slug}.md.
   Include: cấu trúc, ngân sách, quyết định, bài học."
```

## § Phase 8 — Summary + Downstream Handoff

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Đề án CĐS {tên đơn vị} — complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Trụ cột: {N} | Dự án: {M} | Kinh phí: {X tỷ}
  Dedup: {Y} ADOPT + {Z} INTEG + {W} UNIQUE
  
  Output: projects/{slug}/export/{name}.docx
  KB: +{N} entries added

  ─── DOWNSTREAM: Tạo tài liệu cho từng dự án ───
  
  Từ Initiative Portfolio, mỗi DA-XX cần:
    ĐXCTĐT → NCKT → TKCS → TKCT → Dự toán → HSMT

  Dùng /new-document-workspace (Scope B: document group)
  Data từ Đề án được kế thừa tự động:
    ├── Tên dự án, phạm vi, kinh phí ← từ portfolio
    ├── Dedup decisions ← từ dedup-report
    └── Policy refs ← từ policy-landscape
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### § Downstream etc-docgen Integration

Khi user chạy `/new-document-workspace` (Scope C: từ Đề án CĐS) cho các dự án con:

**TKCS / TKCT / TKKT** → dùng etc-docgen pipeline:
```
1. Đọc initiative-portfolio.md → lấy DA-XX info
2. Đọc dedup-report.md → dedup decisions
3. Đọc policy-landscape.md → legal refs
4. etc-docgen MCP: section_schema({doc_type}) → get field defs
5. Auto-populate content-data.json skeleton với inherited data:
   - project.display_name ← DA-XX tên
   - project.client ← Đề án đơn vị chủ trì
   - tkcs.legal_basis ← policy refs
   - tkcs.necessity ← từ initiative rationale
6. doc-writer fills remaining fields → merge_content
7. validate → export → .docx
```

**Dự toán / HSMT / HSDT** → Pandoc pipeline (unchanged):
```
1. Kế thừa data qua DCB injection (existing flow)
2. doc-writer → Markdown prose
3. export.ps1 → .docx
```
