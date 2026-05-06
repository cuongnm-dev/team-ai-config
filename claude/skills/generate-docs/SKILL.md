---
name: generate-docs
description: Sinh trọn bộ tài liệu kỹ thuật ETC từ mã nguồn dự án — gồm Thiết kế Kỹ thuật, Thiết kế Cơ sở, Thiết kế Chi tiết, Hướng dẫn sử dụng, Test Case. Tự động dispatch nhiều agent chạy song song và render ra file Word/Excel hoàn chỉnh thông qua MCP server etc-platform.
---

# 🛑 STOP — READ THIS FIRST

## ⚠️ MCP-First Path Routing
**Path read paths updated for SDLC 2-tier structure.** Stage 1-4 readers must use new nested location:

| Legacy path | New path (post-ADR-003) |
|---|---|
| `docs/features/F-NNN/_state.md` | `docs/modules/M-NNN-{slug}/_features/F-NNN-{slug}/_feature.md` |
| `docs/features/F-NNN/feature-brief.md` | `docs/modules/M-NNN-{slug}/module-brief.md` (module-level scoped digest) |
| Glob `docs/features/F-*/test-evidence.json` | `Bash("ai-kit sdlc resolve --kind feature --id F-NNN")` returns canonical path (parse stdout JSON) |

Stage 4 readers (catalog/HDSD/test-case writers): use `Bash("ai-kit sdlc resolve --kind feature --id F-NNN --include-metadata")` to get path + metadata in 1 call.

**This is generate-docs CONSUMER-SIDE path adjust only per D10-8 boundary** — producer logic (tdoc-* writer agents) UNTOUCHED. Full producer refactor deferred to future enterprise-scope refactor.

**Reference**: ADR-003 D8 + D10-8.

---

**Nếu bạn đang có ý định tạo bất kỳ file `.py` nào** (vd `pipeline_build.py`, `gen_content_data.py`, `orchestrator.py`, `hydrate_screens.py`, `build_*.py`) — **DỪNG LẠI NGAY**. Đây là **anti-pattern**, vi phạm design của skill.

## Pipeline = parallel Agent dispatch + MCP tools, KHÔNG phải Python script

Skill này orchestrate qua **Agent tool (run_in_background) + 6 MCP tools + dedicated sub-agents** (tdoc-researcher, tdoc-test-runner, doc-intel, ...). Bạn **KHÔNG tự viết code orchestration**.

| Task | Cách làm ĐÚNG (Claude Code) | Cách làm SAI |
|---|---|---|
| Run research stages | `Agent(subagent_type="tdoc-researcher", prompt="...")` | Inline scan toàn bộ codebase trong main loop |
| Read intel | `Read` tool with absolute path | `open(...).read()` trong script |
| Search code | `Glob` for files, `Grep` for patterns | `subprocess.run(['grep', ...])` |
| Write content-data | `Write` tool + explicit user review request | `json.dump(...)` trong script |
| Validate schema | `mcp__etc-platform__validate(content_data=current_state)` | `python validate.py` |
| Render Office | HTTP `POST /uploads` (curl) → `mcp__etc-platform__export_async(upload_id=…)` → `mcp__etc-platform__job_status(job_id=…)` → HTTP `GET /jobs/{id}/files/{name}` (curl) | `mcp__etc-platform__export(content_data=dict)` (deprecated >50KB); `python render_docx.py` |
| Capture UI (HDSD) | `Agent(subagent_type="tdoc-test-runner")` background | `subprocess.run(['npx', 'playwright', ...])` |
| Track progress | `TodoWrite` tool (in-session state) | Manual notes |
| Long task | `Agent(run_in_background=true)` | Block main loop |

## Stage 4 PARALLEL dispatch (★ Claude Code strength)

Group A (4b/4c/4d) writers run truly parallel trong 1 message. **Specialist agents per doc type** (per `phases/s4-orchestrator.md`):

```
# In ONE message, dispatch 3 specialist agents concurrently:
Agent(subagent_type="tdoc-tkkt-writer", prompt="EXECUTE phases/s4b-write-tkkt.md. SLUG=<slug>. DOCS_PATH=<path>.")
Agent(subagent_type="tdoc-tkcs-writer", prompt="EXECUTE phases/s4c-write-tkcs.md. SLUG=<slug>. DOCS_PATH=<path>.")
Agent(subagent_type="tdoc-tkct-writer", prompt="EXECUTE phases/s4d-write-tkct.md. SLUG=<slug>. DOCS_PATH=<path>.")
```

3 specialists (TKKT/TKCS/TKCT) run concurrently. Wait all 3 → dispatch 4e HDSD via `tdoc-data-writer` → wait → dispatch 4f xlsx via `tdoc-data-writer` (HDSD + xlsx still use generic writer; sequential dependency).

**Cache discipline (per `~/.claude/schemas/intel/CACHE_OPTIMIZATION.md`):**
- Prompt prefix `EXECUTE phases/s4X-write-Y.md.` is STATIC per phase → cached at sub-agent system level
- Variable values (`SLUG`, `DOCS_PATH`) appear ONCE at end → don't pollute prefix
- Each specialist sub-agent system prompt (`tdoc-tkkt/tkcs/tkct-writer.md`) is fully static → cached cross-invocation
- Stage 4 is ONE-SHOT (not looped) → cache benefit limited; primary gain is at sub-agent .md system prompt level (cached after first dispatch in session)

## ★ Anti-padding rule (DEPTH > LENGTH)

Word count thresholds là **indicative targets cho substantive content**, NOT hard floors để pad filler. Stage 5b validator (`phases/s5b-quality-gate.md` Pass 4 Banned Phrases + Pass 5 Word Count) enforces these checks; `notepads/hanh-chinh-vn-rules.md` lists banned formulaic phrases. (Note: `cursor-rules/*.mdc` files in this skill are Cursor-only auto-attach rules; Claude Code reads thresholds inline via Stage 5b.)

**FORBIDDEN patterns** (phát hiện ngay khi reviewer đọc):
```
❌ "Hệ thống đáp ứng yêu cầu, đảm bảo tính linh hoạt, phù hợp xu hướng hiện đại..."
❌ Lặp ý cũ với synonyms để dài thêm
❌ Câu chuyển tiếp dài để câu giờ
```

**Decision when section is short**:
1. Re-scan intel artifacts (actor-registry, feature-catalog, sitemap, code-facts, doc-brief)
2. Có data thực → expand với specifics + citations (`source: "intel/<file>#<section>"`)
3. Intel dry → emit `[CẦN BỔ SUNG: <gap cụ thể>]`, log to `intel/expansion-gaps.md`
4. **NEVER** pad with formulaic prose

Stage 5a depth pass enforces this; Stage 5b validator detects filler patterns. Specialists writing in Stage 4 phải prefer **structural completeness + specificity** over prose length.

## Trường hợp duy nhất được dùng Python

Chỉ khi dùng **bundled script có sẵn** `engine/auth_runner.py` hoặc `engine/process_screenshots.py` (Stage 3 Playwright session) — **GỌI CÓ SẴN, KHÔNG VIẾT MỚI**.

---

# Generate Documentation — 6-Stage Pipeline

**Output language**: Vietnamese cho user, English cho instructions.
**Render engine**: `etc-platform` MCP (8 tools, chuẩn enterprise). Skill là **thin adapter** — research/write bằng LLM, render bằng MCP deterministic.

---

## Intel Layer Integration (CLAUDE.md CD-10)

This skill participates in the shared Intel Layer at `{workspace}/docs/intel/`. See `INTEL_INTEGRATION.md` for full contract. Key changes vs legacy:

- **NEW Stage 0.5 — Intel Bootstrap** (probe + reuse + interview fallback) between Stage 0 and Stage 1
- **Path migration:** Intel artifacts moved from `docs/generated/{slug}/intel/` → `docs/intel/` (workspace-level, shared with from-doc/from-code)
- **REMOVED:** `frontend-report.json` (absorbed into `sitemap.routes[].playwright_hints`)
- **REQUIRED:** Producers call `intel-merger` when existing artifact present; consumers check `_meta.artifacts[file].stale`
- **Schemas:** `~/.claude/schemas/intel/{actor-registry,permission-matrix,sitemap,feature-catalog,_meta}.schema.json`

**Reuse-first summary** (CD-10 #9 mandate): At Stage 0 preflight, after intel artifact existence checks pass, MUST print per artifact found:
```
For each REQUIRED intel artifact (actor-registry, permission-matrix, sitemap, feature-catalog) where _meta.artifacts[file].stale == false:
  Print: "♻ {file}: reused (fresh, age: {N}d, producer: {p})"
```
Silent reuse (skip without summary) is FORBIDDEN. Re-discovery when intel is fresh is FORBIDDEN per CD-10 #9. Only override is `--rerun-stage N` flag.

## 🏛 Pipeline Architecture (6 stages)

Pipeline được tổ chức theo enterprise patterns: **TOGAF ADM** (Discovery before Analysis), **Zachman Framework** (roles-first), **SAP Activate** (role catalog in Prepare phase), **Microsoft DocOps** (single source of truth, validation gates), **IBM RUP** (stage = milestone with deliverables).

```
┌─────────────────────────────────────────────────────────────────────────┐
│ STAGE 0  PREFLIGHT      Foundation: paths, MCP probe, route, auth       │
│   → Gate 0: env ready                                                   │
│                                                                          │
│ STAGE 1  DISCOVERY      WHO/WHAT/WHY at high level (★ ROLE-FIRST)        │
│   1.1  System inventory       (stack, services, DBs)                    │
│   1.2  Actor enumeration      (roles, RBAC mode)         ★ early        │
│   1.3  Domain skeleton        (modules, feature names)                  │
│   → Gate 1: scope confirmed by user                                     │
│                                                                          │
│ STAGE 2  ANALYSIS       Deep extraction — role-aware from Stage 1       │
│   2.1  Information arch       (entities, rules, state machines)         │
│   2.2  Functional arch        (features role-tagged, workflows)         │
│   2.3  UX architecture        (sitemap, menu, dashboard, selectors)     │
│   2.4  Code facts             (deterministic, parallel)                 │
│   → Gate 2: cross-stage consistency                                     │
│                                                                          │
│ STAGE 3  CAPTURE        UI evidence (HDSD only)                         │
│   3a  Screenshots             (workspace + features per role)           │
│   3b  Validation              (coverage ≥ 95%)                          │
│   → Gate 3: coverage threshold met                                      │
│                                                                          │
│ STAGE 4  SYNTHESIS      Writers produce content-data.json               │
│   4   Orchestrator                                                       │
│   4a  Shared (project, meta, overview, diagrams)                        │
│   4b  TKKT  ┐                                                           │
│   4c  TKCS  ├ Group A parallel (architecture writers)                   │
│   4d  TKCT  ┘                                                           │
│   4e  HDSD                    (after Group A — needs architecture)      │
│   4f  xlsx                    (after HDSD — needs services.features)    │
│   → Gate 4: all blocks dod_met=true, cross-ref OK                       │
│                                                                          │
│ STAGE 5  QUALITY        Validate + refine                               │
│   5a  Depth pass              (expand short sections)                   │
│   5b  Quality gate            (6 passes)                                │
│   5c  Self-critique           (optional adversarial review)             │
│   → Gate 5: validate() clean, no blocking warnings                      │
│                                                                          │
│ STAGE 6  DELIVERY       Render binary outputs                           │
│   6   Composer review + MCP export + verification                       │
│   → Pipeline complete                                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Phase files

| Stage | File | Owner |
|---|---|---|
| Stage 0 | `phases/s0-preflight.md` | Main pipeline (inline) |
| Stage 1 | `phases/s1-discovery.md` | Dispatcher (Path A → doc-intel; Path B → tdoc-researcher) |
| Stage 2 (Path A) | `phases/s2a-doc-harvester.md` | doc-intel agent |
| Stage 2 (Path B) | `phases/s2b-code-research.md` | tdoc-researcher agent |
| Stage 2.4 | `phases/s2c-code-facts.md` | Deterministic bash |
| Stage 3a | `phases/s3a-capture.md` | tdoc-test-runner agent |
| Stage 3b | `phases/s3b-validation.md` | tdoc-screenshot-reviewer agent |
| Stage 4 | `phases/s4-orchestrator.md` | Multi-agent dispatcher |
| Stage 4a-4f | `phases/s4{a,b,c,d,e,f}-write-*.md` | Writer specialists |
| Stage 5a | `phases/s5a-depth-pass.md` | Orchestrator |
| Stage 5b | `phases/s5b-quality-gate.md` | Orchestrator (6 passes) |
| Stage 5c | `phases/s5c-self-critique.md` | strategic-critique agent (optional) |
| Stage 6 | `phases/s6-export.md` | tdoc-exporter agent + MCP |

---

## 📋 EXACT TOOL CALL SEQUENCE

```
Stage 0  (Preflight, bash terminal)
├─ s0-preflight.md sub-steps 0.1 → 0.6
└─ Gate 0 → advance

Stage 1  (Discovery — high-level scope)
├─ Dispatch per route:
│   Path A: Agent(doc-intel, mode=discovery-only)
│   Path B: Agent(tdoc-researcher, scope=stage1-only)
│   Path AB: both in parallel → merge
├─ Outputs: actor-registry.json, system-inventory.json, domain-skeleton.json
└─ Gate 1: user confirms scope → advance

Stage 2  (Analysis — deep extraction, role-aware)
├─ Same producers as Stage 1, scope=stage2 (re-invoke OR continue)
├─ 2.1 information arch    → arch-report.json (data part)
├─ 2.2 functional arch     → flow-report.json (features role-tagged)
├─ 2.3 UX architecture     → sitemap.json (menu+dashboard+selectors)
├─ 2.4 code facts          → code-facts.json (parallel deterministic)
└─ Gate 2: cross-ref check → advance

Stage 3  (Capture — only when "hdsd" in targets)
├─ s3a-capture.md          → screenshots/*.png + screenshot-map.json
├─ s3b-validation.md       → screenshot-validation.json
└─ Gate 3: coverage ≥ 95% → advance

Stage 4  (Synthesis — multi-agent writers)
├─ s4-orchestrator.md drives the DAG:
│   4a shared (inline) → Group A parallel (4b/4c/4d) → 4e → 4f
├─ Each specialist: merge_content() loop until dod_met=true
├─ Cross-ref validation between merged blocks
└─ Gate 4: all blocks done + cross-ref OK → advance

Stage 5  (Quality)
├─ s5a-depth-pass.md       (expand short sections)
├─ s5b-quality-gate.md     (6 passes — link, integrity, quantity, semantic, cross-ref, completeness)
├─ s5c-self-critique.md    (optional, score 60-79 → recommended)
└─ Gate 5: mcp__etc-platform__validate clean → advance

Stage 6  (Delivery — job-based: 2 curl + 2 MCP calls)
├─ Composer diff review (MANDATORY pause)
├─ Bash curl POST /uploads (file=@content-data.json) → upload_id    (out-of-band, 0 LLM tokens)
├─ mcp__etc-platform__export_async(upload_id, targets) → job_id       (~30 tokens)
├─ mcp__etc-platform__job_status(job_id) (poll until terminal)        (~30 tokens per poll)
├─ for each output: Bash curl GET /jobs/{id}/files/{name} → disk    (out-of-band, 0 LLM tokens)
└─ Verify outputs → completion card
```

**KHÔNG có bước nào tạo file `.py`**. Nếu agent đang draft 1 file `.py` cho bất kỳ bước trên — đó là anti-pattern, stop ngay.

**Separation of concerns** (strict):
- Agent: Stage 0 → Stage 5 (research, analyze, write JSON)
- MCP: Stage 6 rendering (docx/xlsx binary output)
- MCP down → BLOCK, user fix container, KHÔNG fallback agent-render

---

## 🚫 ANTI-PATTERNS — KHÔNG LÀM

| ❌ Sai | ✅ Đúng |
|---|---|
| Tạo `build_docs_pipeline.py` / `generate_all.py` monolithic script | Chạy từng stage theo s0 → s6 |
| Agent chạy `render_docx.py` / `fill_xlsx_engine.py` từ Stage 6 | MCP là owner rendering — agent uses job-based flow (HTTP upload + `export_async` + HTTP download) |
| Inline `mcp__etc-platform__export(content_data=full_dict)` for payloads > 50 KB | Upload via HTTP `POST /uploads` then `export_async(upload_id=...)` — bytes never enter LLM context |
| Fallback Python subprocess khi MCP down | BLOCK, ask user restart container |
| Loop through 5 targets và render từng file | 1 MCP call với `targets=[...]` — MCP loop internally |
| Skip Stage 1 (Discovery) → run Stage 2 directly | Stage 1 mandatory — establishes role context |
| Detect roles in Stage 2 mid-extraction | Roles MUST be in actor-registry.json from Stage 1.2 |
| Re-scan code in Stage 2.3 to find menu | Use sitemap data already extracted in Stage 1+2 |
| Skip Composer diff review vì "user chưa yêu cầu" | Composer review = MANDATORY exit Stage 5 |
| Skip `diagrams` block vì "intel thiếu data" | Emit placeholder Mermaid — mỗi diagram PHẢI có source |
| Mark specialist `status: "done"` while `errors[]` or `warnings[]` non-empty | NOT PASS = NOT DONE — loop until `merge_content()` returns `dod_met:true` |
| Call `validate()` separately after `merge_content()` | `merge_content()` already validates — one round-trip, not two |

---

## DEFINITION OF DONE (DoD) — MANDATORY for every specialist/stage

### Primary mechanism: merge_content returns inline feedback

**Do NOT call `validate()` as a separate step.** Use `merge_content()`:

```python
result = mcp__etc-platform__merge_content(current_data=current_state, partial={"<block>": {...}}, auto_validate=True)
# result.validation = {valid, errors[], warnings[], dod_met, action_required}
```

### Autofix loop (uncapped, per specialist)

```python
result = merge_content(data_path, partial)
while not result["validation"]["dod_met"]:
    issues = result["validation"]["errors"] + result["validation"]["warnings"]
    result = merge_content(data_path, fixed_partial)
# If 3 consecutive loops do not reduce len(issues) → escalate to USER
```

A specialist returns `status: "done"` ONLY when `dod_met: true`.
Stage 4 advances to Stage 5 ONLY when ALL specialists returned `dod_met: true`.
Stage 5 advances to Stage 6 ONLY when `validate()` returns clean.

### Warning routing (cross-block)

| Warning prefix | Owning specialist (Stage 4 sub-step) |
|---|---|
| `architecture.*` | tkkt (4b) |
| `tkcs.*` | tkcs (4c) |
| `tkct.*` | tkct (4d) |
| `tkct.modules[N].*` | tkct (4d) |
| `test_cases.*` | xlsx (4f) |
| `[F-NNN].*` | xlsx (4f) |
| `diagrams.*` orphan source | shared (4a) |
| `{block}.*_diagram` orphan ref | block owner |

### Whitelist (4 warning classes allowed to pass without fix)

1. **Business-only fields** — TKCS Section 10/11: emit `[CẦN BỔ SUNG]`
2. **`features_without_test_cases`** — Stage 4f xlsx adds them later
3. **`priority_distribution`** — stats warning only
4. **Module `flow_diagram` missing** — only when TKCT explicitly does not render that module

All other warnings → MUST FIX. No exception.

---

## 🎯 Claude Code first-class features used

| Feature | Stage | Purpose |
|---|---|---|
| **Agent tool (parallel)** | 4 | Group A 4b/4c/4d dispatched concurrent in 1 message |
| **Agent tool (background)** | 1, 2, 3 | `run_in_background=true` for long research/capture; main loop continues |
| **TodoWrite** | All | In-session state tracking — visible to user, replaces external state file |
| **Glob + Grep + Read** | 1, 2 | Direct file/pattern search; for VN content use compound queries |
| **Specialized sub-agents** | 1-3 | `tdoc-researcher` (Stage 1+2 code path), `doc-intel` (Stage 1+2 doc path), `tdoc-test-runner` (Stage 3a), `tdoc-screenshot-reviewer` (Stage 3b), `tdoc-tkkt-writer` / `tdoc-tkcs-writer` / `tdoc-tkct-writer` (Stage 4b/4c/4d specialists), `tdoc-data-writer` (Stage 4e HDSD + 4f xlsx generic), `tdoc-exporter` (Stage 6) |
| **Extended thinking** | 2.2 | Feature grouping reasoning in `tdoc-researcher` Stage 2.2 |
| **Long context (Opus)** | 4 | Writers consume full content-data + intel without truncation |
| **Subagent isolation** | 1-4 | Each agent has own context — orchestrator (main) doesn't accumulate research clutter |

---

## 🛠 SETUP một lần (per workstation)

### 1. Verify sub-agents available

```bash
ls ~/.claude/agents/ | grep -E "tdoc-|doc-intel"
# Should list:
#   tdoc-researcher.md, tdoc-test-runner.md, tdoc-screenshot-reviewer.md,
#   tdoc-tkkt-writer.md, tdoc-tkcs-writer.md, tdoc-tkct-writer.md (Stage 4 specialists)
#   tdoc-data-writer.md (Stage 4 HDSD/xlsx generic), tdoc-exporter.md
#   doc-intel.md, doc-intel-module.md, doc-intel-validator.md
```

### 2. Verify notepads (reference docs read by writer agents)

```bash
ls ~/.claude/skills/generate-docs/notepads/
# Should include sitemap-schema.md (canonical multi-role contract)
```

Writer sub-agents read these via `Read` tool when prompted.

### 3. MCP server

```bash
docker ps | grep etc-platform-mcp-server
# Nếu chưa chạy:
cd ~/.ai-kit/team-ai-config/mcp/etc-platform && docker compose up -d
```

`~/.claude/mcp.json` configured separately.

### 4. Permissions (settings.json)

Allowed for autonomous Stage 3 + 6:
- `python ~/.claude/skills/generate-docs/engine/*` (auth_runner, process_screenshots)
- `docker exec` (for MCP container management)
- `mcp__etc-platform__*` (validate, merge_content, section_schema, validate_uploaded, export_async, job_status, cancel_job, upload_capacity)
- `Bash(curl:*)` for HTTP `/uploads` and `/jobs/*/files/*` (Stage 6 byte transfer; bytes never enter LLM context)
- `mcp__etc-platform__*` (template_registry_load, outline_load, kb/dedup/intel-cache)
- Stage 3a capture: dispatched via `Agent(subagent_type="tdoc-test-runner")` which runs Playwright via `npx playwright` subprocess. Claude Code does NOT register Playwright MCP — Cursor edition uses `mcp__playwright__*` directly; Claude edition uses subprocess CLI through tdoc-test-runner.
- `Agent` with `tdoc-*` and `doc-intel*` subagent types

---

## ⚡ AUTO-ADVANCE PROTOCOL (Claude Code)

End-to-end autonomous qua 6 stages via Agent dispatch. Pause **chỉ** ở:

- **Gate 1**: user confirms scope (roles, modules) — explicit prompt pause via TodoWrite + AskUserQuestion
- **Gate 4 → 5**: cross-ref diff review — show user diff, ask continue
- **Gate 5 → 6**: final content-data review — show user diff, ask approve before MCP export
- Hard blocker (Docker down, auth failed 2×, MCP unreachable)
- User interrupt (Esc)

**Claude Code không có Composer** — gates implemented qua explicit AskUserQuestion + TodoWrite update. Main loop pause until user responds.

Flag: `/generate-docs --pause-between-stages` để pause every transition (verbose mode).

---

## 🎛 ARGS DISPATCH

| Invocation | Stages | Output |
|---|---|---|
| `/generate-docs` hoặc `all` | All 6 stages, all 5 docs | 5 files |
| `/generate-docs tkcs` | All stages, export TKCS | `thiet-ke-co-so.docx` |
| `/generate-docs tkct` | All stages, export TKCT | `thiet-ke-chi-tiet.docx` |
| `/generate-docs tkkt` | Skip Stage 3 (no HDSD) | `thiet-ke-kien-truc.docx` |
| `/generate-docs hdsd` | Stage 3 mandatory | `huong-dan-su-dung.docx` |
| `/generate-docs xlsx` | Skip Stage 3 | `kich-ban-kiem-thu.xlsx` |
| `/generate-docs docx` | All except xlsx-only | 4 docx |
| `/generate-docs discovery` | Stage 0-1 only | actor-registry, domain-skeleton |
| `/generate-docs research` | Stage 0-2 only | All intel/*.json |
| `/generate-docs export` | Stage 6 only (reuse content-data) | 5 files |

Case-insensitive tokens: `hdsd | tkkt | tkcs | tkct | xlsx | testcase | tc | docx | all | discovery | research | export`.

**Auto-skip Stage 3** nếu `hdsd` không trong targets.

---

## § Hybrid Path A + B (Stages 1-2)

Trước đây: strict Path A HOẶC Path B. Vấn đề: A thiếu code facts, B thiếu nghiệp vụ.

**Mới**: Có thể chạy **cả Path A + Path B song song** ở Stage 1-2:
- **Path A** (LLM doc-intel) — prose + business từ docs/ (~10K tokens)
- **Path B** (LLM tdoc-researcher) — versions + routes + entities + sitemap (~3K JSON)
- **Stage 2.4** (deterministic bash) — code-facts.json (~0 LLM tokens)

Stage 2 merge: prose fields ← Path A, hard facts ← Path B, conflict → Path B wins for code/architecture, Path A wins for business prose.

---

## § Resume flow

Ngắt giữa chừng, chạy lại `/generate-docs` — skill detect qua file:

| File có sẵn | Stage đã complete |
|---|---|
| `intel/actor-registry.json` + `system-inventory.json` + `domain-skeleton.json` | Stage 1 |
| `intel/feature-catalog.json` + `sitemap.json` + `code-facts.json` | Stage 2 |
| `screenshots/*.png` ≥ N + `screenshot-validation.json` | Stage 3 |
| `output/content-data.json` (post-merge) | Stage 4 |
| `intel/quality-report.json` (passed) | Stage 5 |
| `output/*.docx` + `*.xlsx` | Stage 6 (done) |

User có thể `@Files intel/actor-registry.json` để load context tiếp.

---

## § State persistence (Claude Code)

Claude Code không có cross-session MEMORIES.md auto-load như Cursor. State được persist qua:

1. **TodoWrite** — in-session: tracks current stage + pending items, visible to user
2. **Artifacts trên disk** — cross-session: pipeline detect resume point từ existing files trong `intel/`, `output/`
3. **Optional `intel/_state.json`** — pipeline tự ghi summary sau mỗi stage:

```json
{
  "slug": "project-name",
  "last_run": "2026-04-25T10:30:00Z",
  "stage_completion": {"s0": "done", "s1": "done", "s2": "done", "s3": "skipped", "s4": "in-progress"},
  "multi_role": true,
  "roles": ["admin", "manager", "staff"],
  "doc_route": "AB",
  "metrics": {"features": 30, "test_cases": 580, "cabosung_markers": 8}
}
```

Resume detection (Stage 0.5) đọc `_state.json` hoặc artifact files để skip completed stages.

---

## § When NOT to use this skill

- Project không có docs/ VÀ không có code structure ETC-standard → output sẽ nhiều `[CẦN BỔ SUNG]`
- Cần Đề án CĐS → `/new-strategic-document`
- Cần dự toán/HSMT/HSDT → `/new-document-workspace` (Pandoc)

---

## § Vendor edition

Cursor edition path: `~/.cursor/skills/generate-docs/SKILL.md` — Composer-driven, Custom Mode-driven, sequential. Same 6-stage architecture, same MCP boundary, same `content-data.json` schema, same `sitemap-schema.md` contract.
