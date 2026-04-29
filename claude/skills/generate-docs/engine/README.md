# engine/ — Claude-side helpers ONLY

> **Architectural rule (CD-8 reaffirmed)**:
> **Claude = THINK | etc-docgen MCP = EXECUTE**

This directory contains **Claude-side automation helpers** that run during
orchestration (capture, briefings, dev tooling). It does **NOT** contain
rendering engines, templates, or schemas — those live exclusively in MCP.

## What's here

| Path | Purpose | When invoked |
|---|---|---|
| `briefings/` | Briefing builder (constructs writer-agent context from intel) | Stage 0 of generate-docs |
| `auth_runner.py` | Playwright auth flow (logs into running app to get session) | Stage 3a (screenshot capture), local browser automation |
| `process_screenshots.py` | Post-process captured screenshots (crop, watermark, naming) | Stage 3a after Playwright |
| `tools/` | Dev tools (e.g. `extract_xlsx_schema.py` for analyzing template) | Manual dev workflow |
| `poc/` | Proof-of-concept experiments | Dev only |

## What's NOT here (moved to MCP — single source of truth)

| Removed file | Now lives in |
|---|---|
| `fill_xlsx_engine.py` | `<MCP image>/src/etc_docgen/engines/xlsx.py` |
| `render_docx.py` | `<MCP image>/src/etc_docgen/engines/docx.py` |
| `synthesize_tc_fallback.py` | `<MCP image>/src/etc_docgen/synthesizers/tc_fallback.py` |
| `templates/test-case.xlsx` | `<MCP image>/src/etc_docgen/assets/templates/test-case.xlsx` |
| `templates/huong-dan-su-dung.docx` | `<MCP image>/src/etc_docgen/assets/templates/huong-dan-su-dung.docx` |
| `templates/build_test_case_template.py` | `<MCP image>/src/etc_docgen/assets/templates/build_test_case_template.py` |
| `schemas/test-case.xlsx.schema.yaml` | `<MCP image>/src/etc_docgen/assets/schemas/test-case.xlsx.schema.yaml` |
| `schemas/content-data.schema.json` | `<MCP image>/src/etc_docgen/assets/schemas/content-data.schema.json` |

## How rendering happens

Claude (orchestrator) NEVER runs rendering Python directly. Instead:

```
Stage 4f (xlsx writer agent) — Test Case generation:
   ├── Synthesize content-data.json
   │     - Path A (assembly): from test-evidence/{feature-id}.json (Cursor QA)
   │     - Path B (fallback): MCP synthesizer endpoint OR pre-bundled tool
   ├── POST localhost:8001/uploads        ← upload content-data.json
   ├── POST localhost:8001/jobs           ← submit job {type: "xlsx"}
   └── GET  localhost:8001/jobs/{id}/files/kich-ban-kiem-thu.xlsx ← fetch result

Stage 4e (HDSD writer agent) — User Manual generation:
   ├── Synthesize content-data.json (services[], features[], steps, dialogs, error_cases)
   ├── POST localhost:8001/uploads
   ├── POST localhost:8001/jobs           ← submit job {type: "hdsd"}
   ├── MCP runs render_docx engine internally (template + Jinja2/docxtpl)
   └── GET  localhost:8001/jobs/{id}/files/huong-dan-su-dung.docx
```

Templates + schemas are **bundled inside MCP server `assets/`** so each render
uses the canonical version. Templates are NOT uploaded per-request.

## When MCP is unavailable

`generate-docs` SKILL.md `CD-8` defines: if MCP HTTP `:8000/readyz` fails, the
skill **MUST BLOCK** and instruct user to start MCP. There is no local Python
rendering fallback — that path was deprecated to enforce single-source-of-truth.

```bash
# To start MCP if not running:
cd ~/.ai-kit/team-ai-config/mcp/etc-platform && docker compose up -d
```

## Cursor SDLC integration (from-doc, resume-feature, close-feature)

Same rule applies. Cursor skills in `~/.cursor/skills/` orchestrate but never
run rendering Python. They call MCP HTTP endpoints (or via the MCP tools
exposed at `localhost:8001/sse` for direct MCP protocol access).

## Updating templates / schemas

To modify template format:

1. Edit MCP source: `<MCP image>/src/etc_docgen/assets/templates/build_test_case_template.py`
2. Regenerate: `python build_test_case_template.py --out test-case.xlsx`
3. Restart container: `docker restart etc-docgen` (picks up bind-mount of `src/`)
4. Test render via HTTP API or MCP tool

NEVER edit the generated `test-case.xlsx` directly — always edit the builder.

## What Claude orchestration code can still do locally

Allowed local Python (NOT rendering):
- Build briefings from intel (briefing_builder.py — Claude-side prompt construction)
- Run Playwright capture (auth_runner.py — local browser automation)
- Post-process screenshots (process_screenshots.py — local image manipulation)
- Read/write intel artifacts (`docs/intel/*.json` — read-only consumption)

NOT allowed locally (must go through MCP):
- Rendering xlsx / docx
- Building templates from scratch
- Validating output against schema (MCP runs validators after render)
- Synthesizing test cases (MCP synthesizers/ has the deterministic logic)
