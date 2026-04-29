# Stage 6 — Delivery (Cursor Edition)

**Cursor pattern**: Composer MANDATORY pause + Cursor 3 Checkpoint + 2 MCP tool calls

**ROLE**: 2 MCP tool calls. Agent surfaces result. MCP server does all rendering.

**SEPARATION OF CONCERNS**:
- Agent: Stage 2 → 3 → 4 → 5 (research, analyze, write JSON)
- MCP: Phase 4 rendering (docx + xlsx + diagrams)
- MCP down → BLOCK. Agent NEVER falls back to Python rendering.

---

## CORE RULES

1. Agent calls exactly 2 MCP tools: `validate` + `export`.
2. Agent reads MCP response, surfaces to user.
3. NEVER run `render_docx.py` / `fill_xlsx_engine.py` from agent.
4. NEVER loop through targets — MCP handles that internally via `targets=[...]`.
5. NEVER create `export_*.py` / `build_*.py` scripts.
6. MCP offline → block with clear message, user fixes container, retry.

---

## Decision tree

```
MCP reachable (TCP port open)?
├─ YES → path-sync → Composer review → 2 tool calls → Done
└─ NO  → BLOCK, user fixes container
         No Python fallback code path.
```

## ★ Pure API mode export (MCP v1.0.0+)

Skill quản lý `content_data` in-memory (Composer state). Stage 6 gửi inline content + screenshots base64 → MCP render → nhận base64 outputs → decode + Write to user repo. NO path-sync, NO bind-mount.

### Step 1 — Validate before export

```python
v_result = mcp__etc-platform__validate(content_data=current_content_data)
if not v_result["valid"] or non_whitelisted_warnings(v_result["warnings"]):
    BLOCK — return Stage 5b
```

### Step 2 — Encode screenshots (HDSD only)

```python
import base64
screenshots_dict = {}
if "hdsd" in targets:
    for img in Path(f"{DOCS_PATH}/screenshots").glob("*.{png,jpg}"):
        screenshots_dict[img.name] = base64.b64encode(img.read_bytes()).decode("ascii")
```

Cursor: chạy qua integrated terminal, paste base64 dict vào Composer.

### Step 3 — Call export

```python
result = mcp__etc-platform__export(
    content_data=current_content_data,
    screenshots=screenshots_dict,
    targets=["xlsx", "hdsd", "tkkt", "tkcs", "tkct"],
    auto_render_mermaid=True,
)
```

### Step 4 — Decode + write to user repo

```python
out_dir = Path(f"{DOCS_PATH}/output")
out_dir.mkdir(parents=True, exist_ok=True)
for filename, b64 in result["outputs"].items():
    (out_dir / filename).write_bytes(base64.b64decode(b64))
```

Files ở `$DOCS_PATH/output/` của user repo, KHÔNG ở etc-docgen container.

---

---

## Completion card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ EXPORT COMPLETE — MCP rendered
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 docs/generated/<slug>/output/
     ├── kich-ban-kiem-thu.xlsx     ({N} TCs)
     ├── huong-dan-su-dung.docx     (~{N} pages, {M} screenshots)
     ├── thiet-ke-kien-truc.docx
     ├── thiet-ke-co-so.docx        ({N} placeholders)
     └── thiet-ke-chi-tiet.docx
  
  🗺 Diagrams: {N}/12+ PNG (mmdc in MCP)
  ⚠ Screenshots missing: {list}
  
  ⏱  MCP call time: {seconds}s
  🎯 Agent: 2 tool calls. MCP: everything else.
  
  Human completion:
    [ ] Review [CẦN BỔ SUNG] markers
    [ ] Ký 2 trang signing
    [ ] Open .docx → F9 refresh TOC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Failure handling

### Container running but MCP returns error

- Surface error to user
- User investigates: `docker logs etc-platform`
- Common causes: corrupt template, content-data schema mismatch, Mermaid syntax error
- Fix root cause → retry `/generate-docs export`

### Container not reachable

- Agent blocks with clear instruction (Step 1)
- DOES NOT render files itself
- User restarts container, retries

### Template missing in container

- Rebuild: `docker compose build && docker compose up -d`
- Container owns templates — agent never touches them

---

## Agent Phase 4 checklist

- [ ] content-data.json written via Composer (Phase 3 exit)
- [ ] quality-report.json score ≥ 60
- [ ] MCP online (port 8000 responds 200)
- [ ] Diagrams block filled (Mermaid source)
- [ ] Screenshots validated if HDSD target (Stage 3b pass)

All ✅ → 2 MCP tool calls → Done.
Any ✗ → resolve FIRST, never bypass MCP.

---

## Anti-patterns

- ❌ `python engine/render_docx.py --template ...` from agent
- ❌ `python engine/fill_xlsx_engine.py ...` from agent
- ❌ Loop through targets manually
- ❌ Fallback Python subprocess when MCP down
- ❌ Generate `export_orchestrator.py`
- ❌ Use `Invoke-WebRequest` on SSE (hangs) — use `curl.exe --max-time 2` with separate capture
