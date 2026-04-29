# /from-doc — Document to SDLC Pipeline (Cursor)

Analyze business documents → create feature _state.md for Cursor `/resume-feature`.
Same architecture as Claude Code version. Simpler: no Figma, inline analysis (no sub-agent).

User-facing output: Vietnamese. Instructions: English.

## State Machine (same as Claude Code)

```
Step 1 → Step 2 → Step 3 → Gate A → Step 4 → Gate B → Step 5 → Step 6
Preflight  Init    Analysis  Confirm   Scaffold  Confirm   Features  Handoff
                   (inline)  analysis  (minimal) path+risk _state.md report
```

## State File: `{workspace}/docs/intel/_pipeline-state.json`

Same schema as Claude Code version. See `.claude/skills/from-doc/SKILL.md`.

## Resume Protocol

Same as Claude Code: read state → check artifacts → skip completed steps → resume.

---

## Step 0 — Detect existing Claude artifacts (fallback mode)

**Purpose**: Continue Claude Code from-doc if user ran out of Claude quota mid-pipeline.

```
IF {workspace}/docs/intel/_pipeline-state.json exists:
  Read state → note current_step, mode, artifacts completed
  Display to user:
    ⚠️ Detected Claude Code from-doc state:
      - Mode: {SMALL|LARGE}
      - Progress: step {current_step}
      - Artifacts done: {N}/{M}
      - Last update: {timestamp}
    
    Cursor can continue but with LIGHTER model (Composer 2, not Opus):
      • §13 Opus insights may be less deep
      • Field type inference relies on heuristics vs domain reasoning
      • Extended thinking not available (Gate B risk matrix still works)
    
    Continue Claude's work? (yes/fresh-start/cancel)
  
  IF yes:
    Skip to effective resume point (see resume protocol).
    For LARGE mode modules/*.md missing: process INLINE (no sub-agent dispatch).
    Add `completed-by: mixed (claude-code + cursor)` to _pipeline-state.json.
  IF fresh-start:
    Backup existing → _pipeline-state.json.bak-{timestamp}
    Continue to Step 1 fresh
  IF cancel:
    STOP
```

**Quality warning to emit**: "Output quality ~75% vs 94% (Claude Opus). Acceptable for fallback, consider re-running in Claude when quota resets for production use."

### LARGE mode fallback (no sub-agent)

If Claude left partial LARGE mode artifacts:
```
modules_pending = [m for m in structure-map.modules if status != "done"]

FOR m in modules_pending:
  # INLINE processing (Cursor has no doc-intel-module sub-agent)
  Read m.pages + m.screenshots from source
  Apply Phase 3 decomposition rules to THIS module
  Write {workspace}/docs/intel/modules/{m.id}.md
  Update structure-map.json: status = "done (cursor-fallback)"

Then REDUCE inline (aggregate all modules/*.md into doc-brief.md).
```

---

## Step 1 — Preflight + Inputs

1. Read `.cursor/AGENTS.md` → extract `repo-type`, `feature-prefix`
   - Not found → stop: "Chạy /new-workspace trước để khởi tạo workspace."
   - Or: "Tôi có thể tạo pipeline artifacts mà không cần workspace — tiếp tục? (yes/no)"
2. If `repo-type: mono` → determine project scope:
   - Scan `src/apps/` and `src/services/` → list to user
   - AskUserQuestion: "Tài liệu thuộc app/service nào?" / "cross-cutting"
3. Gather input files (drag-drop or path)
4. Resolve docs-path:

| Scope | project-path | docs-path |
|---|---|---|
| mini | `.` | `docs/features/{id}` |
| mono — cross-cutting | `.` | `docs/features/{id}` |
| mono — app | `src/apps/{name}` | `src/apps/{name}/docs/features/{id}` |
| mono — service | `src/services/{name}` | `src/services/{name}/docs/features/{id}` |

**State**: `current_step: "2"`

---

## Step 2 — Init + copy files

1. `mkdir -p {docs-path}/intel {docs-path}/docs/source`
2. Copy input files → `{docs-path}/docs/source/`
3. Init `_pipeline-state.json`

**Artifacts**: copied files
**State**: `current_step: "3"`

---

## Step 3 — Analysis (inline — no sub-agent)

Cursor runs analysis directly (no doc-intel agent). Same phases, executed inline:

### 3a. Extraction

| Format | Strategy |
|---|---|
| `.pdf` | Read(path, pages="1-20") — native. Batch by 20 pages. |
| `.docx` | Read(path) — native text. Python for embedded image extraction. |
| `.png/.jpg` | Read(path) — vision model direct. |
| `.xlsx` | Read(path) — native cells. |
| `.txt/.md` | Read(path) — direct. |

Parallel Read calls for multi-file (max 8 parallel).
WebSearch for legal/standards references (max 5).

write: `{docs-path}/intel/raw-extract.md`

### 3b. Deep analysis (multi-pass for docs with >3 modules)

**Pass 1: Structure** — modules, top-level features.
**Pass 2: Per-module deep-dive** — FOR each module: re-read text + screenshots tagged to it → detailed features per Phase 3.3 rules.
**Pass 3: Cross-module** — shared entities, integrations, approval chains.
**Pass 4: Business rules** — 2-5 rules per feature (target: rules ≥ features × 2).

**Decomposition rules (MANDATORY)** — split composite items:
- "Danh muc: A, B, C, D" → 4 separate features (one per catalog)
- "Xuat kho: điều chuyển, thực sử dụng, khác, bán, tạm ứng" → 5 features
- Cấp II input + Cấp III approval → 2 features (different actors)

**Feature detail format** (NOT single table row — use structured spec):
```
#### Feature: {name}
- Type: CRUD | Report | Config | Workflow
- Actors, Entities, Key fields (≥5), Business rules (≥2), Screens, Workflow, Validations, Reports
```

Produce 12-section analysis:
1-12. {same as before}

write: `{docs-path}/intel/doc-brief.md`

**Decomposition self-check before finalize:**
- `features ≥ modules × 4` | `rules ≥ features × 2` | `screens ≥ features × 1.2`
- No composite feature name | All feature descriptions ≥ 10 words
- OCR coverage 100% (no sampling)
- IF any fails → re-run affected pass

### 3c. Tech stack inference

Repo type, services, stacks, shared infra, auth model.
Context7 validation for recommended stacks (max 3 queries).

write: `{docs-path}/intel/tech-brief.md`

### 3d. Gap handling (bounded, max 2 iterations)

```
LOOP (max 2):
  IF blocking-gaps ≤ 3 → BREAK
  Collect answers via AskUserQuestion
  Write gap-answers.md → re-analyze affected sections
  
After 2 iters + gaps > 3:
  ask-user-question: "Tiếp tục (gắn [CẦN BỔ SUNG])" / "Hủy"
```

**Artifacts**: `raw-extract.md`, `doc-brief.md`, `tech-brief.md`
**State**: `current_step: "gate-a"`

---

## Gate A — Confirm analysis

Same LOOP pattern as Claude Code:

```
loop:
  iter = state.steps["gate-a"].iterations
  IF iter >= 3 → force: ["Xác nhận" / "Hủy"]
  
  Read doc-brief.md + tech-brief.md from disk
  Display Vietnamese summary
  
  answer = AskUserQuestion: ["✅ Xác nhận" / "✏️ Sửa" / "🔄 Phân tích lại" / "❌ Hủy"]
  
  IF "Xác nhận" → BREAK
  IF "Sửa" → collect corrections, re-analyze affected sections, iter++, CONTINUE
  IF "Phân tích lại" → re-run Step 3 fresh, iter=0, CONTINUE
  IF "Hủy" → STOP
```

**State**: `gate-a.confirmed: true`, `current_step: "4"`

---

## Step 4 — Scaffold (minimal in Cursor)

Cursor typically already has workspace (AGENTS.md found in Step 1).

```
IF AGENTS.md exists AND project dirs exist:
  → skip scaffold entirely
IF AGENTS.md exists BUT project dirs missing:
  → mkdir -p {project-path}/docs/features (mono)
IF no AGENTS.md (user chose to continue without):
  → mkdir -p docs/features (mini fallback)
```

No Figma, no design tokens in Cursor simple mode (Claude Code handles those).

**State**: `current_step: "gate-b"`

---

## Gate B — Confirm path + risk

Same structured risk assessment as Claude Code:

```
Score 1-5: business-rules | actors | integrations | auth | ui | data-sensitivity
risk_score = ceil(avg)
path = S (1-2) | M (3) | L (4-5)
```

```
loop:
  iter = state.steps["gate-b"].iterations
  IF iter >= 3 → force: ["Xác nhận" / "Hủy"]
  
  Display risk table + path + stages
  answer = AskUserQuestion: ["✅ Xác nhận" / "✏️ Sửa" / "🏗️ Dừng (tạo thủ công)" / "❌ Hủy"]
  
  IF "Xác nhận" → BREAK
  IF "Sửa" → edit, iter++, CONTINUE
  IF "Dừng" → skip Step 5, jump Step 6
  IF "Hủy" → STOP
```

**State**: `gate-b.confirmed: true`, `current_step: "5"`

---

## Step 5 — Create feature _state.md

### 5a. Read data from disk

```
Read doc-brief.md → system-name, modules, features, screen-count, flags
Read tech-brief.md → repo-type, services, auth
From gate-b → risk_score, path, output_mode
```

### 5b. PREFIX + sequence

Derive PREFIX from system-name. Scan existing dirs for sequence.

### 5c. Decompose modules → pipelines + dependency graph

Same logic as Claude Code: ≤3 modules → 1 pipeline, >3 → per-module.
Dependency analysis: entity refs, business rule refs, screen data refs between modules → `depends-on` list per pipeline.
Cycle detection: merge cycled pipelines into one.

### 5d. Derive stages-queue

Same logic: path S/M/L base + conditional additions.

### 5e. Write feature-brief.md per pipeline (PARALLEL with _state.md)

Same as Claude Code Step 5f.5 — generate scoped digest per pipeline.

For Cursor simple mode (1 pipeline, intel per-feature):
- Path: `{docs-path}/feature-brief.md`
- Content: scoped subset of `{docs-path}/intel/doc-brief.md`
- Fields: scope manifest, in/out scope, feature specs, applied rules, entities (scoped), screens (scoped), Opus insights, test data pointer, feature-specific DoD
- Why: matches contract — `feature-req` primary points to feature-brief

For single-feature Cursor runs, feature-brief ≈ doc-brief subset (trivial copy if 1 feature covers all modules). Still generate it for contract consistency.

### 5f. Write _state.md (parallel with 5e)

Same template as Claude Code (includes `depends-on`, `blocked-by`, `clarification-notes`, `figma-file-url: null`, `agent-flags.ba`, body sections). Contract: `.cursor/skills/from-doc/SKILL.md`.

feature-req:
```yaml
feature-req: |
  file:{docs-path}/feature-brief.md       # PRIMARY (generated in 5e)
  canonical-fallback:{intel-path}/doc-brief.md   # {intel-path} = {docs-path}/intel in Cursor simple mode
  scope-modules: [...]
  scope-features: [...]
  dev-unit: {unit}
```

`intel-path` in Cursor simple mode = `{docs-path}/intel` (per-feature, unlike Claude Code shared `docs/intel`).

### 5f. Write feature-map.yaml

Same schema as Claude Code.

**Artifacts**: `_state.md` per pipeline, `feature-map.yaml`
**State**: `current_step: "6"`

---

## Step 6 — Handoff

```
✅ from-doc hoàn tất
Feature ID:   {id}
system:       {name}
path:         {S|M|L}
stages:       ba → {stages-queue}

▶ Tiếp tục: /resume-feature {feature-id}
```

**State**: `current_step: "complete"`

---

## Failure Matrix

Same as Claude Code. Key difference: Step 3 is inline (no agent retry — re-run section directly).

## Hard Constraints

- NEVER fabricate business rules — flag `[INFERRED - verify]`
- NEVER skip OCR for any image
- NEVER create features at root `docs/features/` in monorepo (except cross-cutting)
- NEVER advance if blocking-gaps > 3 (without user consent)
- MUST create all 18+ fields in _state.md — missing field = dispatcher fail
- MUST write `completed-stages.doc-intel` — proves analysis ran
