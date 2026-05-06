# MCP Contract — etc-platform Server

**Single source of truth** cho etc-platform MCP usage rules. Replaces previously duplicated content in `~/.claude/CLAUDE.md` § "etc-platform MCP Rules" và `~/.cursor/AGENTS.md` § "etc-platform MCP".

> **Last updated:** 2026-05-06 (post-v3.2.0 — 11 NEW SDLC scaffolding tools added per ADR-003 D6/D7/D8/D11).
> **Stability:** stable; changes require coordinated update of dependent skills.

## 1. Topology

| Component | Address | Notes |
|---|---|---|
| FastMCP server (SSE) | `http://localhost:8001/sse` | Tool surface — primary client endpoint |
| HTTP API (FastAPI) | `http://localhost:8001` | REST endpoints `/uploads`, `/jobs`, `/workspaces`, `/healthz`, `/readyz` |
| Container | `etc-platform` (image `o0mrblack0o/etc-platform:latest`) | Single container — render engines + registry baked in |
| Source | `~/.ai-kit/team-ai-config/mcp/etc-platform/` | Folder rename pending WSL2 lock release |

Back-compat alias `:8000/sse` còn active trong giai đoạn migration (sẽ retire sau 2026-Q3).

## 2. Tool surface (35 tools post-v3.2.0, FastMCP-prefixed `mcp__etc-platform__*`)

**Breakdown**: 24 EXISTING (pre-v3.2.0) + 11 NEW SDLC scaffolding (added v3.2.0 per ADR-003 D6/D7/D8/D11) = 35 total.

### Render pipeline (existing, unchanged)
- **Validation**: `validate(content_data)`, `validate_uploaded(upload_id)`, `validate_workspace(workspace_id)` — Pydantic ContentData
- **Export**: `export(...)`, `export_async(...)` — render Office files
- **Jobs**: `job_status(job_id)`, `cancel_job(job_id)`, `upload_capacity()`
- **Schemas**: `schema()`, `section_schema(doc_type)` — content data schema introspection
- **Content**: `merge_content(base, patch)` — deep merge với auto-validate
- **Field map**: `field_map(doc_type)` — interview-to-field mapping
- **Templates (render-side)**: `template_list()`, `template_fork(source_path, kind)` — Office template management

### Registry / KB (existing, unchanged)
- **Outlines**: `outline_load(doc_type, version)`, `outlines_list()` — IMMUTABLE outlines NĐ 45/2026 (TKCT/TKCS/TKKT/HSMT/HSDT/dự toán/NCKT/thuyết minh/báo cáo CT)
- **KB**: `kb_query(...)`, `kb_save(...)` — legal refs, ATTT patterns, NFR boilerplate
- **DEDUP**: `dedup_check(...)`, `dedup_register(...)` — CT 34 §6 cross-project deduplication
- **Intel cache**: `intel_cache_lookup(...)`, `intel_cache_contribute(...)` — cross-project pattern library
- **Templates (workspace-side)**: `template_registry_load(namespace, template_id)`, `templates_registry_list(namespace)` — new-workspace stack scaffolds (renamed to avoid collision với render-side `template_list/template_fork`)

### SDLC scaffolding (NEW v3.2.0 — 11 tools per ADR-003)

Per CD-8 v3 enforcement: skills MUST call these instead of `Write`/`mkdir`/glob for SDLC structure.

- **Atomic create (5)**: `scaffold_workspace(workspace_path, workspace_type ∈ {mini,mono}, stack)`, `scaffold_app_or_service(...)`, `scaffold_module(M-NNN, name, slug, ...)`, `scaffold_feature(M-NNN, F-NNN, name, slug, ...)`, `scaffold_hotfix(H-NNN, name, slug, patch_summary, ...)`
- **Refactor (1)**: `rename_module_slug(M-NNN, new_slug, reason)` — atomic slug evolution + alias entry per D10-1
- **Read (1)**: `resolve_path(kind ∈ {module,feature,hotfix}, id, include_metadata)` — REPLACES skill glob fallback for `docs/{modules,features,hotfixes}/**`
- **Repair (1)**: `autofix(fix_classes[], dry_run, confirm_destructive)` — orphan-removal functional; missing-scaffold/schema-migrate/id-collision-resolve/cross-ref-repair pending verify integration
- **Mutate (1, consolidated)**: `update_state(file_path, op ∈ {field,progress,kpi,log,status}, ...)` — 5 ops via discriminator pattern; enforces locked-fields[]
- **Verify (1, consolidated)**: `verify(scopes[] ∈ 8 kinds, strict_mode ∈ {block,warn,info}, context)` — catches F-061 namespace collision bug class via id_uniqueness scope
- **Templates (1, consolidated)**: `template_registry(namespace, action ∈ {list,load}, template_id)` — replaces 2 separate list+load tools per D11

**Tool budget**: 35 tools at hard cap per ADR-003 D10-5. D11 consolidation saved net 18 slots vs initial 53-tool sketch (29 NEW granular + 24 existing). User MCPs (Figma, Playwright, scheduled-tasks, etc.) cohabit Cursor's 50-tool ceiling with 15+ slots free.

## 3. Default ON, opt-out via flag

Skills default to MCP for centralized state. Local fallback when MCP unavailable; skill must still complete (print warning, không silent fail).

**Opt-out:**
- CLI flag `--no-mcp`
- Env var `ETC_USE_MCP=0`

**Universal precedence:** Mọi agent/skill reference local KB / DEDUP / templates / outlines, KHI MCP-enabled session, PHẢI prefer MCP tool over local file scan. Files chưa cập nhật individually inherit default này.

## 4. Bootstrap

First install:
```bash
cd ~/.ai-kit/team-ai-config/mcp/etc-platform/
docker compose up -d
```

Outlines + KB schema baked into image. KB starts empty — populate via `kb_save`.

## 5. Anonymization mandate (intel cache)

`intel_cache_contribute` requires:
- `contributor_consent=True` (explicit user opt-in)
- Server-side scan passes (no email/phone/CCCD/Bộ-Tỉnh-Sở patterns)

Caller pre-redacts; server is last line of defense.

## 6. CD-8 — Office routing single source of truth

All Office rendering (DOCX/XLSX) goes through MCP `/jobs` API. Render engines (`docx.py` + `xlsx.py` + diagram renderer + synthesizers) bundled vào container at `<MCP image>/src/etc_platform/engines/`. Templates ở `assets/templates/` cùng image.

**Mandatory flow** (Stage 6 export):
1. `POST localhost:8001/uploads` — upload `content-data.json`
2. `POST localhost:8001/jobs` — submit `{type: "tkct"|"tkcs"|"tkkt"|"hdsd"|"xlsx", upload_id}`
3. `GET  localhost:8001/jobs/{id}` — poll status
4. `GET  localhost:8001/jobs/{id}/files/{name}` — download rendered Office file

**Forbidden patterns:**
- ❌ `python render_docx.py ...` subprocess from Claude/Cursor side
- ❌ `python fill_xlsx_engine.py ...` subprocess
- ❌ `python fill-manual.py` / `python fill-testcase.py` (legacy paths — moved into MCP image)
- ❌ Local `templates/*.docx` reads — templates bundled in MCP

**MCP down → BLOCK**: Skill MUST instruct user `docker compose up -d`. No silent Python fallback. Non-negotiable per CD-8.

## 7. PDF conversion (optional)

- Word MCP separate (NOT etc-platform): `mcp__word_document_server__convert_to_pdf` — call after docx export
- Not registered → skip + warn user, manual convert via Word UI

Word/Excel MCP re-enable (nếu PDF convert cần):
- Word MCP: `uvx --from office-word-mcp-server word_mcp_server` + add to `mcp.json`
- Excel MCP: `dotnet tool install --global Sbroenne.ExcelMcp.McpServer` (Windows + Excel 2016+ + .NET SDK)

## 8. Migration history (post-merge 2026-04-28)

Pre-merge state: `etc-platform` (port 8000, registry-only) + `etc-platform` (port 8001, render-only) ran as 2 separate MCPs. Consolidated 2026-04-28 into single container at port 8001.

**Migration path for existing skills:**
- Replace `localhost:8000` → `localhost:8001` (back-compat alias `:8000/sse` còn active during migration)
- Tool prefix unified: `mcp__etc-platform__*` (FastMCP server-internal name)
- Cursor `mcp.json` registers cả `etc-platform` (:8000/sse) lẫn `etc-platform` (:8001/sse) aliases — both work
- Claude Code `settings.json` chỉ enable `etc-platform` alias

## 9. Anti-patterns (cross-cutting)

- ❌ Hard-code `localhost:8000` trong skill mới — luôn dùng `:8001`
- ❌ Bypass MCP để write trực tiếp local KB file — vi phạm single-writer principle
- ❌ Silent fall-through khi MCP down — luôn print warning visible cho user
- ❌ Contribute intel cache without consent flag — server reject nhưng caller phải double-check

## References

- Cache discipline: `CACHE_OPTIMIZATION.md`
- Intel layer contract: `LIFECYCLE.md` §5
- Outline coverage: `OUTLINE_COVERAGE.md`
- Conflict resolution: `README.md` § Conflict Resolution
