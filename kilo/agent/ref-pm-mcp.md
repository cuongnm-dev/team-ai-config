---
description: MCP × Agent mapping. Which role skill uses which MCP server tools. Auto-load when role needs to know if MCP is appropriate for a task.
mode: subagent
model: anthropic/claude-sonnet-4-20250514
---

# PM × MCP Reference

> **STATUS**: Mapping of role skills to MCP server tools they may invoke.

## Role × MCP Tool Matrix

| Role | etc-platform | context7 | github | figma | fetch |
|---|---|---|---|---|---|
| pm | kb_query (decisions), dedup_check (DEDUP) | — | — | — | — |
| ba | dedup_check (existing features), kb_query (precedent) | — | — | — | — |
| sa | dedup_check (architecture patterns), kb_query | resolve-library-id, query-docs | — | — | — |
| designer | — | — | — | get_design_context, get_screenshot, get_metadata | — |
| tech-lead | dedup_check (similar plans) | — | — | — | — |
| dev | — | resolve-library-id, query-docs | — | get_code_connect_map | — |
| fe-dev | — | resolve-library-id, query-docs | — | get_code_connect_map, add_code_connect_map | — |
| qa | — | — | — | get_screenshot (visual evidence) | — |
| reviewer | validate (doc structural check) | — | — | get_code_connect_map (UI traceability) | — |
| security | — | — | — | — | — |
| devops | — | — | — | — | — |
| release-manager | — | — | gh.releases | — | — |
| sre-observability | — | — | — | — | — |
| data-governance | kb_query (compliance precedent) | — | — | — | — |

## Workflow × MCP Tool

| Workflow | etc-platform | context7 | github | figma | fetch |
|---|---|---|---|---|---|
| /generate-docs | upload_capacity, validate, export, schema, section_schema, merge_content, outline_load | — | — | — | — |
| /from-doc | dedup_check, dedup_register, intel_cache_lookup, intel_cache_contribute | — | — | — | fetch (web research) |
| /from-code | intel_cache_contribute (anonymized) | — | — | — | — |
| /intel-refresh | (none — local code scan) | — | — | — | — |
| /strategic-critique | dedup_check (proposed solutions) | — | — | — | — |
| /adr | kb_query (related ADRs) | resolve-library-id | — | — | — |
| /runbook | — | — | gh.api | — | — |
| /incident | — | — | gh.issues, gh.pulls | — | — |
| /release | — | — | gh.releases, gh.actions | — | — |
| /ui-catalog | — | — | — | get_design_context | — |
| /audit | — | — | gh.api (PR diffs) | — | — |

## Anonymization Mandate (etc-platform.intel_cache_contribute)

`contributor_consent=True` REQUIRED. Server PII scan default-deny.

## Bootstrap

If MCP server not running → `docker compose up -d` from `~/.ai-kit/ai-kit/mcp/etc-platform/`.

## Forbidden patterns (CD-8)

- ❌ Subprocess `python render_docx.py` from skill side
- ❌ Subprocess `python fill_xlsx_engine.py`
- ❌ Local templates/*.docx reads — MCP image bundles templates

All Office rendering MUST go through `etc-platform.export`. No local fallback.
