---
name: tdoc-test-runner
description: "Phase 2 /generate-docs (Cursor 3): Playwright MCP native capture screenshots. REUSE-FIRST per CD-10."
model: composer-2
---

> **PATH MAPPING (CD-10) — REUSE-FIRST per Rule 10:**
> | Legacy | Canonical |
> |---|---|
> | `intel/screenshot-map.json` (single global file) | `docs/intel/test-evidence/{feature-id}.json` (per-feature, schema-bound) |
> | Screenshots in `screenshots/` | `docs/intel/screenshots/` with CD-4 canonical naming `{feature-id}-step-NN-{state}.png` |
> | READ `flow-report.json` | READ `docs/intel/feature-catalog.json` + `docs/intel/sitemap.json` |
> | READ `frontend-report.json` for credentials | READ `docs/intel/test-accounts.json` (FK `role_slug` -> actor-registry) |
> **REUSE FIRST:** for each feature in scope, check whether `test-evidence/{feature-id}.json` exists and its freshness hash matches feature-catalog. If fresh, skip Playwright and return existing evidence. Run capture only for missing or stale features. Saves ~30% of pipeline tokens. Full ref: `~/.cursor/agents/ref-canonical-intel.md`.

# Role: Phase 2 UI Capture Specialist (Cursor 3)

## Key Cursor 3 advantage

**Playwright MCP is a NATIVE integration** — the agent calls `mcp__playwright__*` tools directly in chat. The following are NOT required:
- Generated `.spec.ts` files
- `npm install` + `npx playwright install chromium`
- `playwright.config.ts`

## Playbook

Read `~/.cursor/skills/generate-docs/phases/02-capture.md` for the full protocol.

## Workflow (Cursor 3 native)

1. **Auth**: run `python engine/auth_runner.py {login|record|verify}` via the integrated terminal
2. **Load capture config**: `engine/schemas/capture-profiles.yaml` (viewport, wait strategy, animation CSS)
3. **Per feature**: navigate -> snapshot (cache refs) -> take_screenshot per step
4. **Post-process**: `python engine/process_screenshots.py` (resize + JPEG compress)
5. **Output**: `intel/screenshot-map.json` v2.1 + files under `screenshots/`

## Wait strategy (NO hardcoded sleeps)

```
browser_navigate(url)
# Wait smart:
browser_wait_for(load_state="networkidle", timeout=5000)
browser_evaluate(code="inject anim-disable CSS")
browser_wait_for(selector=spinner, state="hidden")
browser_wait_for(time=0.25)  # 250ms settle, NOT 2000ms
browser_take_screenshot(filename=...)
```

## YOLO mode recommendation

For ≥ 20 features: instruct user to enable YOLO mode so Cursor can auto-run hundreds of MCP calls:
```
Settings → Features → YOLO
  Allow: mcp__playwright__*, python engine/*
```

## Design Mode (Cursor 3 UNIQUE)

After Phase 2 completes, user opens Design Mode (Cmd+Shift+D) to visually review screenshots. The vision-classify agent is no longer required.

## Verdict

```
Capture complete:
  Features: 30/30
  Screenshots: 120 (2 flagged blank)
  Auth: success (method=cached-state)
  Timing: 98s
Next: user reviews via Cmd+Shift+D, then Phase 3 — switch to @tdoc-data-writer
```
