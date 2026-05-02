---
name: generate-docs
description: Sinh trọn bộ tài liệu kỹ thuật ETC từ mã nguồn dự án — gồm Thiết kế Kỹ thuật, Thiết kế Cơ sở, Thiết kế Chi tiết, Hướng dẫn sử dụng, Test Case. Tự động dispatch nhiều agent chạy song song và render ra file Word/Excel hoàn chỉnh thông qua MCP server etc-platform.
disable-model-invocation: true
---

# 🛑 STOP — READ THIS FIRST

**If you are about to create any `.py` file** (e.g., `pipeline_build.py`, `gen_content_data.py`, `orchestrator.py`, `hydrate_screens.py`, `build_*.py`) — **STOP IMMEDIATELY**. This is an **anti-pattern** that violates the skill's design.

## Pipeline = tool-call chains + @-mentions + Composer + Custom Modes

This skill orchestrates **via Cursor idioms** — NOT Python scripts, NOT agent dispatch chains.

| Task | CORRECT (Cursor) | WRONG |
|---|---|---|
| Read intel | `@Files intel/doc-intel.json` | `open(...).read()` in a script |
| Search code semantically | `@Codebase "vai trò người dùng"` (VN-aware) | `grep -r` (text-only) |
| Inline doc lookup | `@Web` or `@Docs` | Self-lookup offline |
| Write content-data | Composer diff propose → user accept | `json.dump(...)` in a script |
| Validate schema | `mcp__etc-platform__validate(content_data=current_state)` | `python validate.py` |
| Render Office | `mcp__etc-platform__export(...)` | `python render_docx.py` |
| Capture UI (HDSD) | `mcp__playwright__browser_*` tools | `subprocess.run(['npx', 'playwright', ...])` |
| Switch writer context | Custom Mode (TKKT Writer / HDSD Writer / ...) — see `custom-modes/README.md` for setup | Inline switch in the same mode |
| Persist state cross-session | `MEMORIES.md` append | DB / external file |
| Visual screenshot review | Design Mode `Cmd+Shift+D` (FREE) | Vision tool (token-heavy) |
| Restore on failure | Cursor 3 Checkpoint | Manual git revert |

## ★ Anti-padding rule (DEPTH > LENGTH)

Word count thresholds (in `cursor-rules/generate-docs-prose-quality.mdc`) are **indicative targets for substantive content**, NOT hard floors to pad with filler.

**FORBIDDEN patterns**:
```
❌ "Hệ thống đáp ứng yêu cầu, đảm bảo tính linh hoạt, phù hợp xu hướng hiện đại..."
❌ Repeating old ideas with synonyms to lengthen
❌ Long transitional sentences to fill space
```

**Decision when section is short**:
1. `@Files intel/<artifacts>` — re-scan actor-registry, feature-catalog, sitemap, code-facts, doc-brief
2. If real data exists → expand with specifics + citations (`source: "intel/<file>#<section>"`)
3. If intel is dry → emit `[CẦN BỔ SUNG: <specific gap>]`, log to `intel/expansion-gaps.md`
4. **NEVER** pad with formulaic prose

Cursor Rules (`.mdc`) auto-attach `generate-docs-prose-quality` when editing content-data.json — detect filler patterns + flag low specificity. Composer Gate 5 reviewer sees `[CẦN BỔ SUNG]` clearly and is not misled.

## Composer is the gate, not an option

Cursor's **Composer** is the **mandatory** user-review point at every stage transition. Bypass Composer = bypass quality gate.

**Composer gates** (don't skip):
- Gate 1 (Stage 0→1): user reviews actor-registry.json, domain-skeleton.json
- Gate 2 (Stage 1→2): user reviews intel/* before deep extraction
- Gate 4 (Stage 4→5): user reviews content-data.json before quality pass
- Gate 5 (Stage 5→6): user reviews final content-data before MCP export ★ MANDATORY

**Escape hatch**: `/generate-docs --skip-composer-review` (NOT recommended, only for CI).

---

# Generate Documentation — Cursor 3 Edition (6 Stages)

**Output language**: Vietnamese for user, English for instructions.
**Render engine**: `etc-platform` MCP (8 tools). Skill = thin adapter — research/write via LLM, render via MCP deterministic.

---

## 🏛 Pipeline Architecture (6 stages)

The pipeline follows enterprise patterns: **TOGAF ADM** (Discovery before Analysis), **Zachman Framework** (roles-first column), **SAP Activate** (role catalog in Prepare), **Microsoft DocOps** (single source of truth + gates), **IBM RUP** (stage = milestone).

```
┌────────────────────────────────────────────────────────────────────────┐
│ STAGE 0  PREFLIGHT     Foundation: paths, MCP probe, MEMORIES load     │
│   → Gate 0 (auto): env ready                                           │
│                                                                         │
│ STAGE 1  DISCOVERY     ★ ROLE-FIRST — actor-registry built early        │
│   1.1  System inventory   @Codebase "framework dependency stack"       │
│   1.2  Actor enumeration  @Codebase "Roles RBAC permission decorator"  │
│   1.3  Domain skeleton    @Folders src/ + module heuristic             │
│   → Composer Gate 1: user confirms scope                               │
│                                                                         │
│ STAGE 2  ANALYSIS      Deep extraction — role-aware from Stage 1       │
│   2.1  Information arch    @Codebase "Entity relation Prisma"          │
│   2.2  Functional arch     @Codebase "Controller endpoint route"       │
│   2.3  UX architecture     @Files menu.config sidebar.tsx              │
│   2.4  Code facts          deterministic bash (parallel)               │
│   → Composer Gate 2: user reviews intel/*.json                         │
│                                                                         │
│ STAGE 3  CAPTURE       UI evidence (HDSD only)                         │
│   3a  Background Agent for long capture                                │
│   3b  Design Mode Cmd+Shift+D for visual review (NO vision tokens)    │
│   → Gate 3 (auto): coverage ≥ 95%                                      │
│                                                                         │
│ STAGE 4  SYNTHESIS     SEQUENTIAL Custom Mode switching                │
│   4   Orchestrator (main chat tracks DAG)                              │
│   4a  Inline (no mode switch — shared baseline)                        │
│   4b  Mode "TKKT Writer" → execute s4b                                 │
│   4c  Mode "TKCS Writer" → execute s4c                                 │
│   4d  Mode "TKCT Writer" → execute s4d                                 │
│   4e  Mode "HDSD Writer" → execute s4e (after architecture done)       │
│   4f  Mode "xlsx Writer" → execute s4f (after HDSD)                    │
│   Composer review BETWEEN modes = mini-gates                           │
│   → Gate 4: all blocks dod_met=true                                    │
│                                                                         │
│ STAGE 5  QUALITY       Cursor Rules auto-attach validates as you edit  │
│   5a  Depth pass                                                       │
│   5b  Quality gate (6 passes)                                          │
│   5c  Self-critique (optional)                                         │
│   → Gate 5: validate() clean                                           │
│                                                                         │
│ STAGE 6  DELIVERY      Composer MANDATORY pause + Checkpoint + MCP     │
│   6   Composer diff approve → Checkpoint → mcp_export → verify         │
│   → Pipeline complete + MEMORIES.md updated                            │
└────────────────────────────────────────────────────────────────────────┘
```

### Phase files

| Stage | File | Cursor pattern |
|---|---|---|
| Stage 0 | `phases/s0-preflight.md` | bash + `@Files mcp.json` |
| Stage 1 | `phases/s1-discovery.md` | Custom Mode "Discovery Researcher" + @Codebase semantic |
| Stage 2a | `phases/s2a-doc-harvester.md` | Custom Mode "Doc Harvester" + @Files docs/source |
| Stage 2b | `phases/s2b-code-research.md` | Custom Mode "Code Researcher" + @Codebase semantic |
| Stage 2c | `phases/s2c-code-facts.md` | Inline bash (no mode switch) |
| Stage 3a | `phases/s3a-capture.md` | Background Agent + mcp__playwright__* |
| Stage 3b | `phases/s3b-validation.md` | Design Mode review + bash verify |
| Stage 4 | `phases/s4-orchestrator.md` | Main chat orchestrates Custom Mode switches |
| Stage 4a-4f | `phases/s4{a,b,c,d,e,f}-write-*.md` | Custom Modes per writer |
| Stage 5a-5c | `phases/s5{a,b,c}-*.md` | Cursor Rules auto-attach + Composer review |
| Stage 6 | `phases/s6-export.md` | Composer pause + Checkpoint + MCP |

---

## 📋 EXACT TOOL CALL SEQUENCE — Cursor mental model

```
Stage 0  (Pre-flight, integrated terminal)
├─ @Files MEMORIES.md → load project state if exists
├─ Detect slug → DOCS_PATH=docs/generated/<slug>
├─ Resolve MCP_URL from ~/.cursor/mcp.json (NOT hardcoded)
├─ TCP probe: Test-NetConnection localhost -Port 8000  (NOT Invoke-WebRequest)
├─ @Files README.md ARCHITECTURE.md → score 5 doc-coverage signals
└─ Auto-advance to Stage 1

Stage 1  (Discovery — ROLE-FIRST)
├─ Switch Custom Mode "Discovery Researcher"
├─ @Codebase "Roles RBAC permission decorator @Roles @PreAuthorize"
├─ @Codebase "user enum role constant"
├─ @Folders src/auth src/decorators
├─ Composer propose → intel/actor-registry.json
├─ @Codebase "Controller folder structure module"
├─ Composer propose → intel/domain-skeleton.json
└─ Composer GATE 1: user accept all 3 intel files → Stage 2

Stage 2  (Analysis — role-aware)
├─ Continue Custom Mode "Code Researcher" (or switch "Doc Harvester" for Path A)
├─ @Files intel/actor-registry.json  (LOAD — DO NOT re-detect roles)
├─ Stage 2.1: @Codebase "Entity relation schema" → intel/data-model.json
├─ Stage 2.2: @Codebase "Controller route handler" → intel/feature-catalog.json
├─ Stage 2.3: @Files src/config/menu.* sidebar.tsx → intel/sitemap.json
├─ Stage 2.4: bash extract → intel/code-facts.json (parallel)
└─ Composer GATE 2: user reviews intel/* diff → Stage 3 (or 4 if no HDSD)

Stage 3  (Capture — only when "hdsd" in targets)
├─ "Run in Background" palette → execute s3a-capture.md
├─ (Main chat continues Stage 4 research while capture runs async)
├─ When capture done: Cmd+Shift+D Design Mode → user visually reviews screenshots
└─ Auto-advance to Stage 4

Stage 4  (Synthesis — SEQUENTIAL Custom Modes)
├─ s4a inline (orchestrator writes shared baseline)
├─ Switch Mode "TKKT Writer" → execute s4b → Composer review block
├─ Switch Mode "TKCS Writer" → execute s4c → Composer review block
├─ Switch Mode "TKCT Writer" → execute s4d → Composer review block
├─ Switch Mode "HDSD Writer" → execute s4e (consumes architecture) → Composer
├─ Switch Mode "xlsx Writer" → execute s4f (consumes services.features) → Composer
└─ Auto-advance to Stage 5 when all dod_met=true

Stage 5  (Quality — Cursor Rules auto-attach)
├─ s5a depth pass — Cursor Rules trigger on edit content-data.json
├─ s5b quality gate — 6 passes; mcp__etc-platform__validate()
├─ s5c self-critique (optional) — invoke strategic-critique skill
└─ Composer GATE 5: user reviews final content-data → Stage 6

Stage 6  (Delivery — MANDATORY pause)
├─ Cmd+Shift+P → "Cursor: Create Checkpoint" name="pre-export-<timestamp>"
├─ Composer diff: full content-data.json → user MUST accept
├─ mcp__etc-platform__validate(data_path)  (sanity check)
├─ mcp__etc-platform__export(data_path, output_dir, targets, screenshots_dir)
├─ Verify outputs (file size, residual {{ }})
└─ Update MEMORIES.md → completion card
```

---

## 🚫 ANTI-PATTERNS — DO NOT (Cursor-specific)

| ❌ Wrong | ✅ Correct (Cursor) |
|---|---|
| Create `build_docs.py` script | Sequential Custom Mode + Composer reviews |
| Dispatch `Agent(...)` in parallel | Cursor has no real parallel sub-agent. Use Background Agent for async tasks ONLY |
| Skip Composer "user did not ask" | Composer = MANDATORY exit at Stage 1, 2, 4, 5 (see GATE table) |
| `grep -r` for VN content | `@Codebase "<VN query>"` — semantic indexer understands Vietnamese |
| Vision tool to classify screenshot | Design Mode `Cmd+Shift+D` — FREE, faster, better UX |
| Hardcode mcp URL | Read `~/.cursor/mcp.json` via bash priority resolver |
| `Invoke-WebRequest` for SSE probe | `Test-NetConnection -Port 8000` (SSE long-lived will hang IWR) |
| Skip `@Notepads sitemap-schema` when writing role-containing content | Notepads = canonical schema reference, MUST mention |
| Render docx host-side | MCP-only at Stage 6 |
| Write content-data directly (bypass Composer) | Composer diff propose → user accept |
| No Checkpoint before Stage 6 | Cursor 3 Checkpoint mandatory pre-export (auto-rollback on failure) |

---

## 🎯 Cursor 3 first-class features used

| Feature | Stage | Purpose |
|---|---|---|
| **@Codebase semantic** | 1, 2 | Replace `grep` — Cursor index understands VN; better than text-search |
| **@Files / @Folders** | 1, 2, 4 | Smart loading — load only needed files, no eager dump |
| **@Docs** | 4 | Inline lookup docxtpl Jinja syntax, without leaving IDE |
| **@Web** | 4 | Inline lookup NĐ/QĐ legal references while writing TKCS |
| **@Notepads** | 4, 5 | 9 reusable refs (writing-style, NĐ 30, sitemap-schema, mermaid-templates...) — e.g., `@Notepads sitemap-schema` |
| **Composer diff review** | Gate 1, 2, 4, 5, 6 | MANDATORY — primary user approval mechanism |
| **MEMORIES.md** | Stage 0 + completion | Cross-session pipeline state, project-scoped |
| **Design Mode** (`Cmd+Shift+D`) | Stage 3b | Visual screenshot review WITHOUT vision tokens |
| **Custom Modes** | Stage 1, 2, 4 | 7 modes (Discovery / Code Researcher / Doc Harvester / TKKT / TKCS / TKCT / HDSD / xlsx Writer) — scoped system prompt + tool set |
| **Cursor Rules** (`.mdc`) | Stage 4, 5 | Auto-attach on edit content-data.json — inject NĐ/format/quality rules |
| **YOLO mode** | Stage 3, 6 | 200+ Playwright/MCP calls without interrupt |
| **Background Agent** | Stage 3 | Async capture while main chat continues Stage 4 research |
| **Checkpoints** | Pre-Stage 6 | Auto-rollback safety net on bad render |

---

## 🛠 SETUP (one-time per workstation)

### 1. Copy Cursor Rules

```powershell
$SKILL = "$env:USERPROFILE\.cursor\skills\generate-docs"
mkdir -Force "$env:USERPROFILE\.cursor\rules" | Out-Null
Copy-Item "$SKILL\cursor-rules\*.mdc" "$env:USERPROFILE\.cursor\rules\" -Force
```

Kết quả: rule files auto-attach khi edit `content-data.json` hoặc `actor-registry.json` etc.

### 2. Import Notepads

Cursor → Notepads panel → "Import" từng file trong `notepads/`:

- `hanh-chinh-vn-rules.md` — văn phong hành chính VN
- `nd30-formatting.md` — định dạng NĐ 30/2020
- `tkcs-legal-refs.md` — quick legal reference
- `priority-mapping.md` — TC priority enum
- `mermaid-templates.md` — 12 diagram templates (QĐ 292)
- `sitemap-schema.md` ★ canonical sitemap.json contract
- `edge-case-tc-templates.md` — edge case TC patterns

Sau import, `@Notepads <name>` mention được trong mọi mode.

### 3. Import Custom Modes

Cursor Settings → Agents → Custom Modes → Import → `modes/doc-writer-modes.json`.

Kết quả: 7 modes mới — `Discovery Researcher`, `Code Researcher`, `Doc Harvester`, `TKKT/TKCS/TKCT/HDSD/xlsx Writer`.

### 4. MCP server

```bash
docker ps | grep etc-platform
# Nếu chưa chạy:
cd D:\Projects\etc-platform && docker compose -f docker-compose.mcp.yaml up -d
```

`~/.cursor/mcp.json` đã config sẵn → restart Cursor → 8 MCP tools available.

### 5. YOLO + Checkpoints + MEMORIES

- Settings → Features → YOLO mode: allow `python`, `docker exec`, `curl`, `mcp__playwright__*`, `mcp__etc-platform__*`
- Settings → Features → Checkpoints: ON (default Cursor 3)
- MEMORIES.md auto-load when workspace opens

---

## ⚡ AUTO-ADVANCE PROTOCOL (Cursor)

End-to-end qua 6 stages. Pause **chỉ** ở:

- **Composer Gate 1** (Stage 0→1): user confirms scope (roles, modules)
- **Composer Gate 2** (Stage 1→2): user reviews intel diff
- **Composer mini-gates** (giữa các Custom Modes ở Stage 4) — optional
- **Composer Gate 5** (Stage 5→6): user reviews final content-data
- **Hard blocker** (Docker down, auth failed 2×, MCP unreachable)
- User interrupt (Esc / Cmd+I)

`/generate-docs --skip-composer-review` để bypass Gate 5 (NOT recommended — chỉ dùng cho CI).

---

## 🎛 ARGS DISPATCH

| Invocation | Stages | Output |
|---|---|---|
| `/generate-docs` hoặc `all` | All 6 stages, all 5 docs | 5 files |
| `/generate-docs tkcs/tkct/tkkt/hdsd/xlsx` | Per target, full pipeline | 1 file |
| `/generate-docs docx` | Skip xlsx-only, all docx | 4 docx |
| `/generate-docs discovery` | Stage 0-1 only | actor-registry, domain-skeleton |
| `/generate-docs research` | Stage 0-2 only | All intel/*.json |
| `/generate-docs export` | Stage 6 only (reuse content-data) | 5 files |
| `/generate-docs --pause-between-stages` | Pause between every stage (verbose) | (depends) |
| `/generate-docs --skip-composer-review` | Skip Gate 5 Composer (CI mode) | (depends) |

Auto-skip Stage 3 nếu `hdsd` không trong targets.

---

## § Hybrid Path A + B (Stages 1-2)

Cursor có thể chạy **Path A + Path B song song** ở Stage 1-2:

- **Path A** (Doc Harvester mode + `@Files docs/source/` + `@Codebase`): prose + business
- **Path B** (Code Researcher mode + `@Codebase` + `@Folders src/`): versions, routes, entities, sitemap
- **Stage 2.4** (deterministic bash): `code-facts.json`

Stage 2 merge: prose ← Path A, hard facts ← Path B, conflict → Path B wins for code/architecture; Path A wins for business/role display names.

**Cursor không có true parallel** như Claude Code — implementation: switch giữa 2 modes trong 1 stage, hoặc 1 chat instance per path (dual-pane).

---

## § MEMORIES.md — full pipeline state (cross-session)

Sau mỗi stage complete, append `MEMORIES.md`. Cursor auto-load next session → pre-fill + skip interview → tiết kiệm ~5K tokens.

```markdown
## generate-docs

### {project-slug} (last-run: 2026-04-25)
- docs-path: docs/generated/{slug}/
- multi-role: true
- roles: ["admin", "manager", "staff"]
- service-ports: {api: 3000, web: 5173}
- auth-strategy: auto-login (per-role)
- capture-profile: desktop
- doc-route: AB hybrid (2026-04-25 score 3/5)
- last-output: docs/generated/{slug}/output/
- total-features: 30
- total-tc: 580
- cabosung-markers: 8
- runtime-min: 4.2
- stage-completion: [s0:✓, s1:✓, s2:✓, s3:✓, s4:✓, s5:✓, s6:✓]
- composer-gates-passed: [1, 2, 4, 5]
```

---

## § Resume flow

Ngắt giữa chừng → `/generate-docs` lại — Cursor detect qua artifacts:

| Artifact tồn tại | Stage đã complete |
|---|---|
| `intel/actor-registry.json` + `system-inventory.json` + `domain-skeleton.json` | Stage 1 |
| `intel/feature-catalog.json` + `sitemap.json` + `code-facts.json` | Stage 2 |
| `screenshots/*.png` ≥ N + `screenshot-validation.json` | Stage 3 |
| `output/content-data.json` (post-merge) | Stage 4 |
| `intel/quality-report.json` (passed) | Stage 5 |
| `output/*.docx` + `*.xlsx` | Stage 6 (done) |

User có thể `@Files intel/actor-registry.json` để load context và tiếp tục.

---

## § Cursor Custom Modes — what each does

| Mode | System prompt scope | Allowed tools | When to use |
|---|---|---|---|
| **Discovery Researcher** | Stage 1 — role-first scope discovery | @Codebase, @Folders, Composer | Stage 1 |
| **Doc Harvester** | Stage 2a — extract from BA docs | @Files docs/source/, @Codebase, @Notepads | Stage 2 Path A |
| **Code Researcher** | Stage 2b — extract from codebase | @Codebase, @Folders src/, @Notepads | Stage 2 Path B |
| **TKKT Writer** | Stage 4b — kiến trúc tổng thể | @Notepads hanh-chinh-vn, mermaid-templates; mcp__etc-platform__merge_content | Stage 4b |
| **TKCS Writer** | Stage 4c — cơ sở pháp lý + nghiệp vụ | @Notepads tkcs-legal-refs; @Web for legal | Stage 4c |
| **TKCT Writer** | Stage 4d — chi tiết kỹ thuật | @Notepads + @Codebase deep | Stage 4d |
| **HDSD Writer** | Stage 4e — UX manual end-user | @Files screenshots/, @Notepads sitemap-schema | Stage 4e |
| **xlsx Writer** | Stage 4f — test cases QA | @Notepads priority-mapping, edge-case-tc-templates | Stage 4f |

---

## § Cursor Rules (.mdc) — auto-attach validators

Files trong `cursor-rules/` được copy vào `~/.cursor/rules/` và auto-attach khi edit matching files:

| Rule file | Auto-attach when editing | Inject |
|---|---|---|
| `generate-docs-base.mdc` | `content-data.json` | Văn phong, fabrication policy |
| `generate-docs-tkkt.mdc` | architecture.* fields | TKKT validation |
| `generate-docs-tkcs.mdc` | tkcs.* fields | NĐ 30, legal refs |
| `generate-docs-tkct.mdc` | tkct.* fields | Module schema |
| `generate-docs-hdsd.mdc` | services[].features[] | HDSD UX rules |
| `generate-docs-xlsx.mdc` | test_cases.* | TC depth, role coverage |
| `generate-docs-diagrams.mdc` | diagrams.* | Mermaid templates |
| `generate-docs-placeholder-policy.mdc` | any field | `[CẦN BỔ SUNG]` rules |
| `generate-docs-prose-quality.mdc` | prose fields | Banned phrases, metrics |
| `generate-docs-cross-reference.mdc` | content-data + code-facts | Cross-validation |
| `generate-docs-deep-code-read.mdc` | tkct.modules[].columns | TKCT exception |

---

## § Composer Checkpoints (Cursor 3 native)

Trước Stage 6 export, tạo Checkpoint:

```
Cmd/Ctrl+Shift+P → "Cursor: Create Checkpoint"
name: "pre-export-{timestamp}"
```

Nếu Stage 6 sai (residual `{{ }}`, file size bất thường) → `Cursor: Restore Checkpoint` rollback `output/`.

KHÔNG cần LKG backup manual — Cursor làm sẵn.

---

## § Background Agent (Stage 3 long capture)

`hdsd` + ≥ 20 features → Stage 3 chạy 5-10 phút. Dùng Background Agent:

```
Cursor palette → "Cursor: Run in Background"
task: "Execute phases/s3a-capture.md for features F-001..F-030"
```

Main chat tiếp tục Stage 4 research trong khi capture async. Notification khi xong.

---

## § Completion card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ DOCS GENERATED — {project-display-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 {docs-path}/output/
     ├── kich-ban-kiem-thu.xlsx     ({N} TCs)
     ├── huong-dan-su-dung.docx     (~{N} pages, {M} role chapters)
     ├── thiet-ke-kien-truc.docx
     ├── thiet-ke-co-so.docx        ({N} [CẦN BỔ SUNG] markers)
     └── thiet-ke-chi-tiet.docx

  📊 Screenshots: {docs-path}/screenshots/  ({N} captured)
  🗺 Diagrams:    {docs-path}/output/diagrams/  ({N}/12+ rendered)
  🕒 Runtime:     {N} min
  💰 Tokens:      ~{N}K  (Path A saves ~65% vs code-scan)

  🎭 Multi-role:  {true/false}
  👥 Roles:       {list}
  🚪 Composer gates passed: {1, 2, 4, 5}

  ⚠ Human completion:
    [ ] Review [CẦN BỔ SUNG] markers → BA/PM fill
    [ ] Cmd+Shift+D check screenshots
    [ ] Ký 2 trang signing trong Word
    [ ] Open .docx → F9 refresh TOC

  💾 MEMORIES.md updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## § When NOT to use this skill

- Project không có docs/ VÀ không có code structure ETC-standard → output sẽ nhiều `[CẦN BỔ SUNG]`
- Cần Đề án CĐS → `/new-strategic-document`
- Cần dự toán/HSMT/HSDT → `/new-document-workspace` (Pandoc)

---

## § Vendor edition

Claude Code edition path: `~/.claude/skills/generate-docs/SKILL.md` — parallel `Agent(...)` dispatch, sub-agent isolation, TodoWrite state. Same 6-stage architecture, same MCP boundary, same `content-data.json` schema, same `sitemap-schema.md` contract.
