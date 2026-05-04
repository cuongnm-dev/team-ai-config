---
name: from-doc
description: Đọc tài liệu mô tả nghiệp vụ (PDF, Word, ảnh, file test case) để phân tích sâu, dựng cấu trúc dự án và sinh hồ sơ từng tính năng theo chuẩn Cursor SDLC. Dùng khi đã có tài liệu yêu cầu nhưng chưa có code. Output - docs/intel/{doc-brief.md, actor-registry, feature-catalog, sitemap}.json + 1 _state.md mỗi feature (status planned). Trigger - có SRS/BRD/wireframe docx/pdf/png; bắt đầu project mới từ tài liệu khách hàng. Anti-trigger - project đã có code đang chạy thì /from-code; chỉ thêm 1 feature thì /new-feature. Example - "/from-doc D:/Projects/portal/docs/SRS-v1.docx" hoặc nhiều file cùng lúc (skill tự gộp).
---

# From Document to Code — Contract & Dual-Producer

Two producers, same architecture, same output:
- **Cursor** (`claude-code/from-doc.md`): PoC / simple / fallback — inline analysis, Composer 2 model
- **Claude Code** (`~/.claude/skills/from-doc/SKILL.md`): Production / complex / full quality — sub-agents, Opus 4.6+, Figma/Context7

Consumer (`/resume-feature` → `dispatcher`) is producer-agnostic.

## Decision tree — When to use which producer

```
q1: Is this a PoC, MVP, or internal tool?
  YES → Cursor `/from-doc` (save Claude quota, Composer 2 sufficient for ≤75% quality)
  NO → Q2

q2: Is this production-critical OR regulated (banking, compliance, healthcare)?
  YES → Claude `/from-doc` (Opus insights, §13 domain reasoning required)
  NO → Q3

q3: Document characteristics?
  - ≤2 files, ≤30 pages, ≤20 screenshots, clear structure → Cursor `/from-doc`
  - Multi-file, >50 pages, >50 screenshots, Figma needed, >5 modules → Claude `/from-doc`
  - Between → Claude `/from-doc` (marginal cost, higher quality)

q4: Claude quota exhausted mid-pipeline?
  → Cursor `/from-doc` continuation mode (Step 0 detects Claude artifacts, resumes)
  → Output ~75% quality (fallback acceptable for MVP, re-run in Claude when quota back for production)
```

## Quality × Cost matrix

| Scenario | Producer | Quality | Cost (tokens) | Time | Use when |
|---|---|---|---|---|---|
| PoC small doc | Cursor | 75% | Low | Fast | Quick validation, internal demo |
| Complex production | Claude | 94% | High | Medium (parallel) | Real delivery |
| Complex + quota out | Cursor fallback | 75% | Medium (skip Claude work) | Slow (sequential) | Emergency continuation |
| Complex re-run after fallback | Claude | 94% | High (redo all) | Medium | Production hardening |

## Cache-aware agent invocation (mandatory for both producers)

**All Agent() / Task() dispatches MUST use 4-block structure** (matches dispatcher contract):

```
## Agent Brief              ← static: role, model, output-mode
## Project Conventions      ← semi-static: per-project (omit if none)
## Feature Context          ← per-pipeline stable: docs-path, repo-path, feature-id
## Inputs                   ← dynamic: per-invocation values
```

**Rules**:
- NEVER put dynamic values above `## Feature Context`
- NEVER reorder blocks (cache keys on exact prefix)
- All 4 block headers present even if content minimal
- Loop invocations (sub-agent dispatch, patch iterations) save ~80% prefix tokens via cache hit

## Shared Architecture (both producers)

```
Step 1 → Step 2 → Step 3 → Gate A → Step 4 → Gate B → Step 5 → Step 6
Preflight  Init    Analysis  Confirm   Scaffold  Confirm   Features  Handoff
```

- State file: `_pipeline-state.json` (same schema)
- Resume: artifact-as-checkpoint (same protocol)
- Gates: explicit LOOP with iteration bound (max 3)
- Steps: idempotent, crash-safe

## _state.md schema (all fields required)

Hyphens for keys. Consumers accept both underscore/hyphen.

```yaml
feature-id: {PREFIX-YYYYMMDD-NNN}
feature-name: {name}
pipeline-type: sdlc
status: in-progress
created: {YYYY-MM-DD}
last-updated: {YYYY-MM-DD}
current-stage: ba
output-mode: {lean|full}
repo-type: {mini | mono}
repo-path: {workspace root}
project: {service name | cross-cutting}
project-path: {"." for mini, "src/apps/{name}" or "src/services/{name}" for mono}
docs-path: {feature dir path}
intel-path: {intel dir — shared "docs/intel" or per-feature "{docs-path}/intel"}
stages-queue: [{stages after ba}]
completed-stages:
  doc-intel: { verdict: "Ready for BA", completed-at: "{date}" }
feature-req: |
  file:{docs-path}/feature-brief.md   # PRIMARY — scoped digest
  canonical-fallback:{intel-path}/doc-brief.md   # fallback if digest missing/stale
  scope-modules: [...]
  scope-features: [...]
  dev-unit: {unit}
source-type: {document-type}
agent-flags:
  ba: { source-type, blocking-gaps, total-modules, total-features }   # agent name = ba (stage and agent share name)
  designer: { screen-count }
  sa: { integration-flags, iot-involved }
  security: { pii-found, auth-model }
depends-on: [{feature-ids required before starting}]
blocked-by: []                             # auto-computed by resume-feature
kpi: { tokens-total: 0, cycle-time-start: "{date}", tokens-by-stage: {} }
rework-count: {}
figma-file-url: {url | null}               # Claude Code producer only
figma-frame-ids: []
pre-scaffold: {true | omitted}             # only when mono + no project dirs
pre-scaffold-target: {intended path}       # only when pre-scaffold: true
clarification-notes: ""                    # initialized empty; PM writes question here on escalation
```

### Body sections (required for resume-feature display + PM tracking)

```markdown
# Pipeline State: {feature-name}
## Business Goal
## Stage Progress (7-row table)
## Current Stage
## Next Action
## Active Blockers (default: "none")
## Wave Tracker
## Escalation Log
```

> **feature-req path rule**: Claude Code uses shared intel (`docs/intel/doc-brief.md`).
> Cursor uses per-feature intel (`{docs-path}/intel/doc-brief.md`).
> Both work — ba reads whatever path is in feature-req.

## Feature Registry (`docs/feature-map.yaml`)

monorepo: REQUIRED. Mini-repo: RECOMMENDED.
Both producers create/update at workspace root.

```yaml
repo-type: mono|mini
features:
  {id}:
    name: {name}
    project: {service}
    docs-path: {path}
    status: in-progress
    current-stage: ba
    depends-on: []              # empty = no dependencies (can start immediately)
    created: {date}
    updated: {date}

# Example with dependencies:
#  HTQLNS-20260416-001:
#    name: "User Management"
#    depends-on: []              # root feature, no deps
#  HTQLNS-20260416-002:
#    name: "Reporting"
#    depends-on: [HTQLNS-20260416-001]  # needs User Management done first
#  HTQLNS-20260416-003:
#    name: "Dashboard"
#    depends-on: [HTQLNS-20260416-001, HTQLNS-20260416-002]  # needs both
```

## Directory structure

```
mini: docs/features/{id}/_state.md + intel/
mono: src/{apps|services}/{name}/docs/features/{id}/_state.md + intel/
Cross-cutting: docs/features/{id}/ (PM designates)
```

## Resume command

```
/resume-feature {feature-id}
```

locate: feature-map.yaml (PRIMARY) → docs/features/ → docs/hotfixes/ → glob (last resort).

## Validation (Cursor verifies before dispatcher)

- [ ] All required fields present in _state.md
- [ ] docs-path resolves to directory containing _state.md
- [ ] intel/doc-brief.md exists at path in feature-req
- [ ] completed-stages has doc-intel
- [ ] stages-queue non-empty
- [ ] repo-type matches workspace

## Mandatory post-validation step — Intel snapshot regen

Right after the validation checklist passes, BEFORE dispatcher hands off the first stage, run the snapshot generator. This is **NOT optional** — without it, base-tier agents (`dev`, `qa`, `reviewer`, `ba`, `sa`) re-read full canonical Tier 1 JSON in every subsequent dispatch (~40K duplicate tokens per agent per feature).

```bash
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path {intel-path}
python ~/.cursor/skills/intel-snapshot/generate.py --intel-path {intel-path} --check
```

Expected output (sequential):
- `[WROTE] {intel-path}/_snapshot.md (X.X KB ~ NNN tokens)`
- `[WROTE] {intel-path}/_snapshot.meta.json`
- `[OK] Snapshot fresh`

**Failure handling** (per intel-snapshot SKILL.md "snapshot is optimization, not correctness"):
- IF generator exits non-zero → WARN user: "Snapshot regen failed — base-tier agents fall back to canonical JSON (slower, no correctness impact)". Continue to dispatcher.
- IF Tier 1 inputs missing → snapshot generates partial (script handles internally). Continue.

Reference: `~/.cursor/skills/intel-snapshot/SKILL.md`. Cursor Rule 24.

## What's next

| Condition | Action |
|---|---|
| PoC / MVP / small doc | Cursor `/from-doc` (save Claude quota) |
| Production / complex / regulated | Claude `/from-doc` → Cursor `/resume-feature` |
| Claude quota exhausted mid-run | Cursor `/from-doc` (Step 0 detects + continues) |
| _state.md already created | `/resume-feature {id}` |
| Docs from existing code | `/generate-docs` |
