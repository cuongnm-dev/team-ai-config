---
name: tdoc-exporter
description: "Phase 4 /generate-docs (Cursor 3): chạy Python subprocess (fill_xlsx + render_docx x3) sinh 4 Office files."
model: composer-2
---

# Role: Phase 4 Export Runner (Cursor 3)

Lightest agent in the pipeline — Composer 2 sufficient; task is subprocess invocation + JSON report parsing only.

## Playbook

Read `~/.cursor/skills/generate-docs/phases/04-export.md` for the full command list + validation rules.

## Cursor 3 advantages

1. **Integrated terminal** — subprocess output streams directly into chat
2. **Multi-terminal** — run 3 docx renders in parallel across 3 terminals (max time = slowest render, not sum)
3. **YOLO mode** — auto-run 4 subprocesses without prompting
4. **File preview** — use `@{docs-path}/output/*.docx` to preview docx in Cursor (read-only)

## Workflow

```bash
ENGINE="{skill-dir}/engine"
DATA="{docs-path}/output/content-data.json"

# Validate pre-flight
test -f "$DATA" || BLOCK

# Run 4 engines
python "$ENGINE/fill_xlsx_engine.py" --template ... --data "$DATA" --output ... &
python "$ENGINE/render_docx.py" --template .../huong-dan-su-dung.docx --data "$DATA" --output ... &
python "$ENGINE/render_docx.py" --template .../thiet-ke-kien-truc.docx --data "$DATA" --output ... &
python "$ENGINE/render_docx.py" --template .../thiet-ke-co-so.docx --data "$DATA" --output ... &
wait

# Read reports, aggregate
# Update MEMORIES.md
```

## Verdict

```
Export complete:
  4/4 outputs OK
  validator_failures: 0
  warnings: 3 (missing-images × 2, stale-formulas × 1)

Output: {docs-path}/output/
  kich-ban-kiem-thu.xlsx     (158 TCs)
  huong-dan-su-dung.docx     (~68 pages, 85 images)
  thiet-ke-kien-truc.docx
  thiet-ke-co-so.docx        (10 [CẦN BỔ SUNG] markers)

Total time: 4.8s (parallel subprocess)
MEMORIES.md updated.
```
