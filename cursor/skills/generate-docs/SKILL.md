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

**FORBIDDEN patterns**: vague claims ("đáp ứng yêu cầu, đảm bảo tính linh hoạt..."), repeating ideas with synonyms, long transitional fillers.

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
STAGE 0  PREFLIGHT     Foundation: paths, MCP probe, MEMORIES load
STAGE 1  DISCOVERY     ★ ROLE-FIRST — actor-registry built early
STAGE 2  ANALYSIS      Deep extraction — role-aware from Stage 1
STAGE 3  CAPTURE       UI evidence (HDSD only)
STAGE 4  SYNTHESIS     SEQUENTIAL Custom Mode switching
STAGE 5  QUALITY       Cursor Rules auto-attach validates as you edit
STAGE 6  DELIVERY      Composer MANDATORY pause + Checkpoint + MCP
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

→ Read `notepads/tool-sequence.md` for the exact per-stage tool-call cheatsheet (`@Codebase` queries, MCP calls, Composer gates).

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

## 🎯 Cursor 3 features + Custom Modes + Cursor Rules (reference)

→ Read `notepads/cursor-features.md` for the 3 reference tables: (a) Cursor 3 first-class features used per stage, (b) 7 Custom Modes (Discovery / Code Researcher / Doc Harvester / TKKT / TKCS / TKCT / HDSD / xlsx Writer), (c) 11 Cursor Rules (`.mdc`) with auto-attach scope.

---

## 🛠 SETUP (one-time per workstation)

→ Read `notepads/setup.md` and execute steps 1-5 (Cursor Rules copy, Notepads import, Custom Modes import, MCP server, YOLO + Checkpoints + MEMORIES toggle).

---

## ⚡ AUTO-ADVANCE PROTOCOL (Cursor)

End-to-end through 6 stages. Pause **only** at:

- **Composer Gate 1** (Stage 0→1): user confirms scope (roles, modules)
- **Composer Gate 2** (Stage 1→2): user reviews intel diff
- **Composer mini-gates** (between Custom Modes at Stage 4) — optional
- **Composer Gate 5** (Stage 5→6): user reviews final content-data
- **Hard blocker** (Docker down, auth failed 2×, MCP unreachable)
- User interrupt (Esc / Cmd+I)

`/generate-docs --skip-composer-review` to bypass Gate 5 (NOT recommended — CI only).

---

## 🎛 ARGS DISPATCH

| Invocation | Stages | Output |
|---|---|---|
| `/generate-docs` or `all` | All 6 stages, all 5 docs | 5 files |
| `/generate-docs tkcs/tkct/tkkt/hdsd/xlsx` | Per target, full pipeline | 1 file |
| `/generate-docs docx` | Skip xlsx-only, all docx | 4 docx |
| `/generate-docs discovery` | Stage 0-1 only | actor-registry, domain-skeleton |
| `/generate-docs research` | Stage 0-2 only | All intel/*.json |
| `/generate-docs export` | Stage 6 only (reuse content-data) | 5 files |
| `/generate-docs --pause-between-stages` | Pause between every stage (verbose) | (depends) |
| `/generate-docs --skip-composer-review` | Skip Gate 5 Composer (CI mode) | (depends) |

Auto-skip Stage 3 if `hdsd` not in targets.

---

## § Hybrid Path A + B (Stages 1-2)

Cursor can run **Path A + Path B in parallel** at Stage 1-2:

- **Path A** (Doc Harvester mode + `@Files docs/source/` + `@Codebase`): prose + business
- **Path B** (Code Researcher mode + `@Codebase` + `@Folders src/`): versions, routes, entities, sitemap
- **Stage 2.4** (deterministic bash): `code-facts.json`

Stage 2 merge: prose ← Path A, hard facts ← Path B; conflict → Path B wins for code/architecture; Path A wins for business/role display names.

**Cursor has no true parallel** like Claude Code — implementation: switch between 2 modes within 1 stage, or 1 chat instance per path (dual-pane).

---

## § State, resume, completion

→ Read `notepads/memories-completion.md` for: MEMORIES.md format (cross-session state), Resume flow (artifact → stage detection map), Composer Checkpoints (Cursor 3 native), Background Agent (Stage 3 long capture), and the final completion card template.

---

## § When NOT to use this skill

- Project has no docs/ AND no ETC-standard code structure → output will be heavy on `[CẦN BỔ SUNG]`
- Need Đề án CĐS → `/new-strategic-document`
- Need dự toán/HSMT/HSDT → `/new-document-workspace` (Pandoc)

---

## § Vendor edition

Claude Code edition path: `~/.claude/skills/generate-docs/SKILL.md` — parallel `Agent(...)` dispatch, sub-agent isolation, TodoWrite state. Same 6-stage architecture, same MCP boundary, same `content-data.json` schema, same `sitemap-schema.md` contract.
