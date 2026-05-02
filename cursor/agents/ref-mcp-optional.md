# Optional MCP Servers — install + register guide

Status snapshot (2026-04-26): Cursor `mcp.json` registers **3 servers**: `playwright`, `etc-platform`, `etc-platform`. Claude Code (user scope) registers **2**: `etc-platform`, `etc-platform`.

Other MCPs referenced by agents/skills are **OPTIONAL** — agents have `IF available` guards. Install + register only when needed for active project.

## Optional MCPs referenced by agents

| MCP            | Used by                                            | Purpose                                          | Install                                                                                | Register entry                                                |
| -------------- | -------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **NX MCP**     | `dev`, `spike`, `arch-review`, `implement`, `adr`  | Project graph, get_affected_projects, generators | `npm i -g nx-mcp` (or via Nx Console)                                                  | `{"command": "nx-mcp"}`                                       |
| **Context7**   | `dev`, `spike`, `arch-review`, `sa`, `implement`   | Up-to-date library docs from registries          | `npm i -g @upstash/context7-mcp`                                                       | `{"command": "npx", "args": ["-y", "@upstash/context7-mcp"]}` |
| **GitHub MCP** | `dev`                                              | PR/issue lookup, repo metadata                   | Per [github.com/github/github-mcp-server](https://github.com/github/github-mcp-server) | with `GITHUB_TOKEN` env                                       |
| **DB MCP**     | `data-governance`, `spike`, `arch-review`          | Live schema queries, PII classification          | Per stack: postgres-mcp / mysql-mcp / mongo-mcp                                        | varies by DB type                                             |
| **Atlan MCP**  | `data-governance`                                  | Data lineage, ownership metadata                 | Atlan SaaS account required                                                            | with API key + workspace url                                  |
| **Word MCP**   | `doc-exporter` PATH A, `tdoc-exporter` PDF convert | Native .docx fill via Word                       | `uvx --from office-word-mcp-server word_mcp_server`                                    | stdio uvx command                                             |
| **Excel MCP**  | `doc-exporter` PATH A xlsx                         | Native Excel fill + formula recalc               | `dotnet tool install --global Sbroenne.ExcelMcp.McpServer`                             | Windows + Excel 2016+ + .NET SDK                              |

## How agents handle missing MCPs

All optional MCP refs are guarded with `IF "<mcp>" in available_mcps` style checks:

- **dev / sa / spike**: NX/Context7/GitHub MCP missing → fallback to manual `Read` + `WebSearch`.
- **data-governance**: Atlan/DB MCP missing → ownership inferred from code/schema files; findings marked `confidence: medium`.
- **doc-exporter**: Word/Excel MCP missing → Python fallback (`fill-manual.py` / `fill-testcase.py`). Already wired.
- **tdoc-exporter**: Word MCP missing → skip PDF convert, warn user.

## Per-project mcp.json (recommended)

Each project repo can declare its own `.mcp.json` to register stack-specific MCPs without polluting the global config:

```json
// /d/Projects/<project>/.mcp.json
{
  "mcpServers": {
    "etc-platform": { "type": "sse", "url": "http://localhost:8001/sse" },
    "playwright": { "command": "npx", "args": ["-y", "@playwright/mcp"] },
    "context7": { "command": "npx", "args": ["-y", "@upstash/context7-mcp"] }
  }
}
```

Cursor merges per-project `.mcp.json` over global `~/.cursor/mcp.json` by entry name.

## Audit checklist (run quarterly)

```
1. Compare ~/.cursor/mcp.json server list vs grep -rE "mcp__|CallMcpTool" agents/ skills/
2. Remove unused registrations (dead-load tax: ~25 tools each = ~500 tokens/turn)
3. Verify guards: every "mcp__X__*" call has IF-available wrap or fallback
4. Test: kill MCP container → re-run skill → verify graceful degrade (no hard error)
```
