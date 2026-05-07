---
description: MCP server reference (etc-platform, context7, github, figma). Auto-load when role skill needs MCP tool access for documentation render, KB query, dedup, intel cache, etc.
mode: subagent
model: anthropic/claude-sonnet-4-20250514
---

# MCP Server Reference

> **STATUS**: Reference skill. Auto-loaded when role skills need MCP tools. Lists available servers + when to invoke.

## Connected MCP Servers

Per `~/.codeium/windsurf/mcp_config.json`:

| Server | Purpose | Common tools |
|---|---|---|
| `etc-platform` | VN gov doc rendering pipeline (TKKT/TKCS/TKCT/HDSD/xlsx) | `merge_content`, `validate`, `export`, `kb_query`, `dedup_check`, `intel_cache_lookup`, `outline_load`, `template_list` |
| `context7` | Live library docs lookup | `query-docs`, `resolve-library-id` |
| `github` | GitHub API (issues, PRs, releases) | repo operations |
| `figma` | Figma design context, Code Connect | `get_design_context`, `get_screenshot`, `add_code_connect_map` |
| `fetch` | Web fetch | URL fetch |
| `filesystem` | File ops (limited scope) | (disabled) |

## When to invoke

| Need | MCP server + tool |
|---|---|
| Render Office doc (DOCX/XLSX) | `etc-platform.export` (workflows: generate-docs, from-doc) |
| Validate doc content schema | `etc-platform.validate` |
| Query knowledge base | `etc-platform.kb_query` |
| Check dedup before propose project | `etc-platform.dedup_check` |
| Pull intel cache hint | `etc-platform.intel_cache_lookup` (anonymized only) |
| Get latest framework docs | `context7.query-docs` |
| GitHub issue/PR ops | `github.*` (skill: incident, runbook) |
| Figma design context | `figma.get_design_context` (skill: ui-catalog, fe-dev) |
| Web fetch (research) | `fetch.*` (skill: from-doc when external ref) |

## Anonymization Mandate (etc-platform.intel_cache_contribute)

`contributor_consent=True` REQUIRED. Server-side PII scan default-deny.

## Bootstrap

If MCP unavailable → `docker compose up -d` from `~/.ai-kit/ai-kit/mcp/etc-platform/`.

## Forbidden patterns (CD-8)

- ❌ `python render_docx.py ...` subprocess from skill side
- ❌ `python fill_xlsx_engine.py ...` subprocess
- ❌ Local `templates/*.docx` reads — templates are bundled in MCP image

All Office rendering MUST go through `etc-platform.export` MCP. No local fallback.

## PDF conversion

If `mcp__word_document_server__*` registered → `convert_to_pdf` post-export. If not → manual via Word UI.
