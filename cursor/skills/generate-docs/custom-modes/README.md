# Custom Modes — generate-docs (Cursor 3)

Each writer phase (Stage 4b/4c/4d/4e/4f) runs in a dedicated Cursor Custom Mode so the LLM has a focused persona + correct tool/auto-attach configuration.

## Setup

Cursor Custom Modes are configured in **Cursor Settings → Modes → Add Custom Mode**. Create one mode per writer:

| Mode name | System prompt source | Allowed @-mentions | Allowed tools | Auto-attach |
|---|---|---|---|---|
| `Discovery Researcher` | `phases/s1-discovery.md` (System prompt section) | `@Codebase`, `@Folders`, `@Files`, `@Docs` | bash (read-only), `mcp__etc-platform__merge_content`, `mcp__etc-platform__kb_query` | none |
| `Doc Harvester` | `phases/s2a-doc-harvester.md` | `@Files`, `@Docs` | bash, `mcp__etc-platform__merge_content` | none |
| `Code Researcher` | `phases/s2b-code-research.md` | `@Codebase`, `@Files` | bash, `mcp__etc-platform__merge_content` | none |
| `Capture Operator` | `phases/s3a-capture.md` | `@Files` | `mcp__playwright__browser_*`, bash | none |
| `Shared Writer` (s4a) | `phases/s4a-write-shared.md` | `@Files`, `@Notepads`, `@Docs` | `mcp__etc-platform__merge_content` | `generate-docs-base`, `generate-docs-diagrams`, `generate-docs-prose-quality`, `generate-docs-placeholder-policy` |
| `TKKT Writer` | `phases/s4b-write-tkkt.md` | `@Files`, `@Notepads`, `@Docs` | `mcp__etc-platform__merge_content`, `mcp__etc-platform__validate` | `generate-docs-base`, `generate-docs-tkkt`, `generate-docs-cross-reference`, `generate-docs-placeholder-policy`, `generate-docs-prose-quality` |
| `TKCS Writer` | `phases/s4c-write-tkcs.md` | `@Files`, `@Notepads` | same as TKKT | `generate-docs-base`, `generate-docs-tkcs`, `generate-docs-placeholder-policy`, `generate-docs-prose-quality` |
| `TKCT Writer` | `phases/s4d-write-tkct.md` | `@Files`, `@Notepads` | same | `generate-docs-base`, `generate-docs-tkct`, `generate-docs-deep-code-read`, `generate-docs-cross-reference` |
| `HDSD Writer` | `phases/s4e-write-hdsd.md` | `@Files`, `@Notepads` (incl. `hanh-chinh-vn-rules`, `sitemap-schema`) | same | `generate-docs-base`, `generate-docs-hdsd` |
| `xlsx Writer` | `phases/s4f-write-xlsx.md` | `@Files`, `@Notepads` (incl. `priority-mapping`, `edge-case-tc-templates`) | same | `generate-docs-base`, `generate-docs-xlsx` |
| `Quality Reviewer` | `phases/s5b-quality-gate.md` | `@Files` | `mcp__etc-platform__validate`, bash | none |
| `Exporter` | `phases/s6-export.md` | `@Files` | `mcp__etc-platform__export`, `mcp__etc-platform__intel_cache_lookup` | none |

## Configuration template

Cursor stores Custom Modes in user settings (`~/.cursor/User/settings.json` or via Settings UI). Suggested JSON shape per mode:

```json
{
  "name": "TKKT Writer",
  "model": "claude-sonnet-4-6",
  "systemPrompt": "Read ~/.cursor/skills/generate-docs/phases/s4b-write-tkkt.md § System prompt. You produce architecture content blocks (TKKT) only — no other blocks. Output JSON conforming to content-data schema.",
  "allowedAtMentions": ["files", "notepads", "docs"],
  "allowedTools": ["mcp__etc-platform__merge_content", "mcp__etc-platform__validate"],
  "autoAttach": ["generate-docs-base", "generate-docs-tkkt"]
}
```

## Why Custom Modes (vs single chat)

- **Persona isolation**: TKKT-Writer doesn't accidentally write HDSD content
- **Auto-attach scoping**: Each mode loads only relevant `.mdc` rules, keeping context lean
- **Tool whitelisting**: Each writer uses only the MCP tools it needs (e.g. xlsx Writer doesn't get Playwright)
- **Cache discipline**: Per-mode static system prompt = better Anthropic prompt cache hit rate

## When to switch modes

Stage 4 orchestrator (or user manually):
1. After Stage 3b validation passes → switch to `TKKT Writer`, run s4b
2. After s4b approved → switch to `TKCS Writer`, run s4c
3. ... etc per Group A → HDSD → xlsx sequence

Use Cursor's mode-switcher UI (bottom-right) — modes preserve workspace context, only the persona/tooling changes.
