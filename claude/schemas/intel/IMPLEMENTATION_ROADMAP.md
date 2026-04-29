# Implementation Roadmap — SDPA Workflow Redesign

**Branch**: `feat/sdpa-workflow-redesign`
**Source of truth**: `WORKFLOW_DESIGN.md` § 0 (7 aligned decisions)
**Approach**: D7 Hybrid (Foundation big-bang + 5 iterations sequential)
**Estimated effort**: ~11-14 ngày nominal (compressed in this session via parallel batch + reuse)

---

## Phase 0 — Setup (✅ DONE)

- [x] Branch `feat/sdpa-workflow-redesign` created
- [x] WORKFLOW_DESIGN.md finalized với 7 decisions
- [x] IMPLEMENTATION_ROADMAP.md (this file) created
- [x] TodoWrite tracking 7-phase + 14-step plan

---

## Phase 1 — Foundation Pass (cross-cutting infrastructure)

**Goal**: Build infrastructure shared by all 5 iterations. Must complete before Iter 1.

### 1.1 — `extract_schema_summary.py` script (NEW)

**File**: `~/.claude/scripts/intel/extract_schema_summary.py`

**Function**:
- Input: schema name (e.g. `feature-catalog`) hoặc `--all`
- Output: markdown summary tại `~/.claude/schemas/intel/_summaries/{name}.md`
- Content: key fields + types + constraints (min/max/pattern/enum), không full JSON Schema

**Acceptance**:
- Run `python extract_schema_summary.py --all` → generate 19 summaries
- Output cache-friendly (deterministic, idempotent)
- Reference D6 trong WORKFLOW_DESIGN.md

### 1.2 — Regenerate `_summaries/` cho 19 schemas

**Files**: `~/.claude/schemas/intel/_summaries/{name}.md` × 19

**Acceptance**:
- 19 markdown files, mỗi file ~50-150 lines
- Cite source schema path
- Inline constraints rõ ràng (min, max, pattern, enum, required)

### 1.3 — Finalize validate.py 3-tier confidence routing (D4)

**File**: `~/.claude/scripts/intel/validate.py`

**Update**:
- Đã có `--strict` bitmask tier-aware (T1/T2/T3 schema errors)
- Thêm: 3-tier confidence routing trong cross-reference report
  - Field có `confidence: high|manual` → silent OK
  - Field có `confidence: medium` → flag in "review queue" output section
  - Field có `confidence: low` → flag in "gap" output section
  - Field unset confidence → warning, treat as medium

**Acceptance**:
- Run validate.py output có 3 sections: ✅ high+manual, ⚠ medium (review), ❌ low (gap)
- Backward-compat: nếu mọi field unset confidence → behavior như binary

### 1.4 — Update intel-validator.md agent với 3-tier output

**File**: `~/.claude/agents/intel-validator.md`

**Update**:
- Pass 6 (Confidence distribution) đã có — refactor làm primary output
- Output format: 3 sections theo confidence tier
- Verdict: tier-aware exit codes (đã có trong agent design)

**Acceptance**:
- Agent dispatch return JSON với `tier_summary: {auto: N, review: N, gap: N}`
- Human summary print 3 sections rõ

### 1.5 — Demote Tier T1/T2/T3 sang secondary tag, Diátaxis primary (D1)

**Files**:
- `~/.claude/schemas/intel/README.md` — restructure: Diátaxis primary section, Tier secondary
- `~/.claude/schemas/intel/OUTLINE_COVERAGE.md` — add Diátaxis tag per doc target

**Update**:
- Add Diátaxis taxonomy table per 5 docs (TKKT=Reference+Explanation, TKCS=Reference+Explanation, TKCT=Reference, HDSD=Tutorial+How-to, xlsx=Reference)
- Tier classification giữ nguyên nhưng demoted thành "Tier (consumer-driven tag)"

**Acceptance**:
- README.md có section "Diátaxis Taxonomy (primary organizing principle)" trên section Tier
- OUTLINE_COVERAGE.md per-doc table có Diátaxis column

---

## Phase 2 — Iteration 1: TKKT (Reference + Explanation)

**Goal**: Validate pattern works on TKKT (T2-heavy + T3-light, code-derivable cao).

### 2.1 — Update `tdoc-tkkt-writer.md` agent

**File**: `~/.claude/agents/tdoc-tkkt-writer.md`

**Update**:
- Add Diátaxis section: "TKKT là Reference + Explanation document. Voice: facts về architecture; rationale chỉ khi cần justify design decision."
- Inline schema summaries từ `_summaries/architecture.md`, `_summaries/system-inventory.md`, `_summaries/integrations.md`, `_summaries/nfr-catalog.md`, `_summaries/security-design.md`
- Add 3-tier confidence handling: nếu field có confidence=low → emit `[CẦN BỔ SUNG]` placeholder; medium → cite source; high/manual → trust

### 2.2 — Update Phase emission cho TKKT (from-code Phase 04)

**File**: `~/.claude/skills/from-code/phases/04-architecture.md`

**Update**:
- Hiện tại Phase 04 emit bridge .md files. Add: emit canonical T2 JSONs:
  - `architecture.json` (cpdt_layers + components + 3 mô hình)
  - `data-model.json` (entities aggregated từ code-facts)
  - `api-spec.json` (endpoints từ routes + DTO inference)
  - `integrations.json` (HTTP clients + LGSP/NGSP detect)
- Mỗi entry có confidence field (high nếu code-derivable, medium nếu inference, low nếu thiếu evidence)
- Anti-skip protocol: phase complete chỉ khi 4 files emit + validate.py --strict pass schema

### 2.3 — Sanity check Iter 1

- TKKT writer prompt cite _summaries inline
- Phase 04 emit canonical T2 + validate
- Đặt TODO cho human review TKKT output sau khi run /generate-docs tkkt

---

## Phase 3 — Iteration 2: TKCT (Reference)

**Goal**: Reuse TKKT pattern, focus engineer audience.

### 3.1 — Update `tdoc-tkct-writer.md` agent

- Diátaxis: "Reference thuần — facts about modules/schema/API/test, no narrative"
- Inline summaries: `_summaries/data-model.md`, `_summaries/api-spec.md`, `_summaries/test-evidence.md`, `_summaries/handover-plan.md`, etc.
- Cross-reference TKKT: "kiến trúc tổng thể tham chiếu §3.3 TKCS"

### 3.2 — Phase emission đã đủ từ Iter 1 (data-model, api-spec)

- Verify api-spec.json có request/response detail (hoặc emit `[CẦN BỔ SUNG]`)
- Verify data-model.tables[].columns đầy đủ DDL

---

## Phase 4 — Iteration 3: TKCS + Build `/intel-fill` skill

**Goal**: Validate T3 fill workflow. Build first version DAG-based interview.

### 4.1 — Build `/intel-fill` skill (P1 simple DAG)

**File**: `~/.claude/skills/intel-fill/SKILL.md`

**Function**:
- Read intel state → identify missing required fields per schema
- Build DAG dependencies (simple — no auto-derive yet)
- Topological order: ask field A trước field B nếu B.depends_on includes A
- Skip fields đã có (lifecycle != not-set)
- Conditional skip: ví dụ nếu deployment.type=cloud, skip hardware questions

**Implementation**: markdown skill (instructions cho LLM), supplementary Python script `~/.claude/scripts/intel/dag_builder.py` (~150 lines)

### 4.2 — Update `tdoc-tkcs-writer.md` agent

- Diátaxis: "Reference + Explanation — facts về thiết kế cơ sở + WHY (rationale, alternatives) cho Bộ TC audience"
- Inline summaries: `_summaries/business-context.md`, `_summaries/architecture.md`, `_summaries/nfr-catalog.md`, `_summaries/security-design.md`, `_summaries/infrastructure.md`, `_summaries/cost-estimate.md`, `_summaries/project-plan.md`
- Banned-jargon discipline (đã có) + Diátaxis Explanation voice (rationale, trade-offs)

### 4.3 — Update from-doc Step 5h business-context emission

**File**: `~/.claude/skills/from-doc/SKILL.md`

**Update**:
- Bổ sung instruction emit `business-context.json` đầy đủ từ doc-brief
- Hard-stop nếu legal_basis < 3, objectives.specific < 3, pain_points < 3

---

## Phase 5 — Iteration 4: HDSD (Tutorial + How-to)

**Goal**: User manual generation pattern.

### 5.1 — Update tdoc-data-writer.md (HDSD branch)

**File**: `~/.claude/agents/tdoc-data-writer.md`

**Update**:
- HDSD section: Diátaxis "Tutorial + How-to" voice
  - Tutorial: step-by-step cho new user, "Bài 1: Đăng nhập lần đầu", focus learning success
  - How-to: task-oriented cho daily user, "Cách tạo tờ khai", focus task completion
- Inline summaries: `_summaries/sitemap.md`, `_summaries/feature-catalog.md`, `_summaries/test-accounts.md`
- Cross-reference TKCT: "chi tiết kỹ thuật xem TKCT §3"

### 5.2 — Defer Cursor QA integration

- HDSD render-time có thể stub `[CẦN BỔ SUNG: screenshot]` nếu test-evidence chưa có
- Document trong `intel-status` skill output: HDSD cần Cursor `/resume-feature` QA stage chạy trước cho rich

---

## Phase 6 — Iteration 5: xlsx test-cases (Reference)

**Goal**: Test case catalog với fallback synthesis (CD-10 quy tắc 18).

### 6.1 — Update tdoc-data-writer.md (xlsx branch)

**Update**:
- xlsx Diátaxis: "Reference — catalog of test cases"
- Inline summaries: `_summaries/test-evidence.md`, `_summaries/feature-catalog.md`
- Fallback synthesis logic (đã design quy tắc 18) — emit warning sheet nếu test_cases status=proposed

---

## Phase 7 — Final E2E + Nghiệm thu Report

### 7.1 — Self E2E sanity check

- Verify all _summaries/ generated
- Verify validate.py --strict run clean trên sample
- Verify 3 writer agents (tkkt/tkcs/tkct) + tdoc-data-writer (HDSD/xlsx) cite _summaries inline
- Verify cross-references between docs (NĐ 30/2020 style)
- Verify /intel-fill skill exists + DAG P1 logic documented

### 7.2 — Generate nghiệm thu report

**File**: `~/.claude/schemas/intel/NGHIEM_THU_REPORT.md`

**Content**:
- 7 decisions implemented checkmark
- Files changed list (full diff scope)
- Files created list
- Migration: cũ → mới mapping
- Known gaps + follow-up
- E2E test recommendation cho user

### 7.3 — Git commit + push

- Commit message reflect 7 decisions + scope
- Push branch `feat/sdpa-workflow-redesign`
- User merge sau nghiệm thu

---

## Risk register

| Risk | Mitigation |
|---|---|
| Token budget cạn giữa session | Phase 1 (Foundation) + Phase 2 (TKKT) là core — đảm bảo ưu tiên. Iter 3-5 có thể defer follow-up |
| Implementation mismatch với decision | Mỗi phase reference D1-D7 explicit |
| Sub-agent cache miss khi inline summary | Test cache discipline — summaries là static prefix, prompts add summaries vào prefix region |
| Forget run extract_schema_summary.py khi schema change | validate.py catch drift; pre-commit hook optional sau |
| Large diff → user khó review | Per-phase commit (atomic), commit message clear |

---

## Out-of-scope cho session này

(Defer tới follow-up sau nghiệm thu)

- Pre-commit hook auto-trigger extract_schema_summary.py
- DAG P2 (conditional skip) + P3 (auto-derive) cho /intel-fill
- /intel-status skill standalone (tạm dùng intel-validator output)
- /intel-init skill bootstrap
- Cursor SDLC QA integration với HDSD/xlsx
- TKKT outline registration vào MCP etc-platform
- E2E test trên customs-clearance-system project (cần user nominate sample)

---

## Definition of Done (cho nghiệm thu)

- [ ] Branch `feat/sdpa-workflow-redesign` có tất cả changes
- [ ] WORKFLOW_DESIGN.md § 0 với 7 decisions
- [ ] IMPLEMENTATION_ROADMAP.md (this file) — checkpoints completed
- [ ] Foundation: extract_schema_summary.py + 19 _summaries/ + validate.py 3-tier + intel-validator updated + Diátaxis primary in README
- [ ] 5 Iterations: writer agents updated cho 5 docs với Diátaxis voice + inline summaries
- [ ] /intel-fill skill v1 (P1 DAG)
- [ ] NGHIEM_THU_REPORT.md với full diff scope + sanity check + recommendations
- [ ] Git commit clean trên branch
- [ ] User notification để vào nghiệm thu

User approve nghiệm thu → merge to main.
