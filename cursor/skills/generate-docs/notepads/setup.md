# Setup — one-time per workstation

Loaded on demand by `generate-docs/SKILL.md` § Setup.

---

## 1. Copy Cursor Rules

```powershell
$SKILL = "$env:USERPROFILE\.cursor\skills\generate-docs"
mkdir -Force "$env:USERPROFILE\.cursor\rules" | Out-Null
Copy-Item "$SKILL\cursor-rules\*.mdc" "$env:USERPROFILE\.cursor\rules\" -Force
```

Result: rule files auto-attach when editing `content-data.json` or `actor-registry.json` etc.

## 2. Import Notepads

Cursor → Notepads panel → "Import" each file in `notepads/`:

- `hanh-chinh-vn-rules.md` — văn phong hành chính VN
- `nd30-formatting.md` — định dạng NĐ 30/2020
- `tkcs-legal-refs.md` — quick legal reference
- `priority-mapping.md` — TC priority enum
- `mermaid-templates.md` — 12 diagram templates (QĐ 292)
- `sitemap-schema.md` ★ canonical sitemap.json contract
- `edge-case-tc-templates.md` — edge case TC patterns

After import, `@Notepads <name>` mention works in every mode.

## 3. Import Custom Modes

Cursor Settings → Agents → Custom Modes → Import → `modes/doc-writer-modes.json`.

Result: 7 new modes — `Discovery Researcher`, `Code Researcher`, `Doc Harvester`, `TKKT/TKCS/TKCT/HDSD/xlsx Writer`.

## 4. MCP server

```bash
docker ps | grep etc-platform
# If not running:
cd D:\Projects\etc-platform && docker compose -f docker-compose.mcp.yaml up -d
```

`~/.cursor/mcp.json` is pre-configured → restart Cursor → 8 MCP tools available.

## 5. YOLO + Checkpoints + MEMORIES

- Settings → Features → YOLO mode: allow `python`, `docker exec`, `curl`, `mcp__playwright__*`, `mcp__etc-platform__*`
- Settings → Features → Checkpoints: ON (default Cursor 3)
- MEMORIES.md auto-load when workspace opens
