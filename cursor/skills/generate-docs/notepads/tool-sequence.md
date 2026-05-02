# EXACT TOOL CALL SEQUENCE — Cursor mental model

Loaded on demand by `generate-docs/SKILL.md` for the per-stage tool-call cheatsheet.

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
