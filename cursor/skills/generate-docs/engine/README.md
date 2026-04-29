# Template-First Document Generation Engine

Deterministic Python engines that turn **structured JSON data** into
**pixel-perfect Office documents** using two industry-standard tools:
- **openpyxl** for Excel (preserves formulas, DV, conditional formatting)
- **docxtpl** (Jinja2 for Word) for .docx — templates contain `{{ var }}` and
  `{% for %}` tags that drive rendering

## Layout

```
engine/
├── templates/                       # BUNDLED — forks of ETC masters
│   ├── test-case.xlsx               # BM.QT.04.04 (openpyxl reads as-is)
│   ├── huong-dan-su-dung.docx       # Jinja-tagged fork of BM.QT.04.05
│   ├── thiet-ke-kien-truc.docx      # Jinja-tagged clone of HDSD (arch layout)
│   └── thiet-ke-co-so.docx          # Jinja-tagged fork of TKCS_v1.2
├── schemas/
│   ├── test-case.xlsx.schema.yaml   # openpyxl write map (only for xlsx)
│   └── capture-profiles.yaml        # viewport + wait strategy
├── tools/
│   ├── extract_xlsx_schema.py       # one-time xlsx analyzer
│   ├── extract_docx_schema.py       # one-time docx analyzer
│   └── jinjafy_templates.py         # fork ETC template → add Jinja tags
├── fill_xlsx_engine.py              # openpyxl-based xlsx filler
├── render_docx.py                   # docxtpl-based docx renderer (~290 lines)
├── process_screenshots.py           # post-capture resize + compress
├── auth_runner.py                   # simple auth runner (user-supplied creds)
└── poc/                             # sample data + stress test generators
```

## Pipeline

```
ETC template.xlsx  ┐
schema.yaml        ├─▶ fill_xlsx_engine.py ─▶ kich-ban-kiem-thu.xlsx
content-data.json  ┘                           (openpyxl)

Jinja-tagged .docx ┐
content-data.json  ├─▶ render_docx.py ─▶ huong-dan-su-dung.docx
screenshots/*.png  ┤                       thiet-ke-kien-truc.docx
                   ┘                       thiet-ke-co-so.docx
                                           (docxtpl)
```

## Why docxtpl for .docx

The skill moved from custom 900-line `fill_docx_engine.py` to **docxtpl (Jinja2 for Word)** — industry-standard choice for template-driven Word rendering:

- **Template authors control layout**: open template in Word, add `{{ var }}` and `{% for %}` tags. No YAML schema to maintain.
- **Less code**: `render_docx.py` is ~290 lines (vs 900). Easier to audit, fewer bugs.
- **Standard tool**: docxtpl is widely used in enterprise docs-as-code pipelines.
- **Community + docs**: any developer can learn Jinja-in-Word patterns from docxtpl docs.

## Template Jinja patterns used

### Paragraph loop — `{%p for %}` / `{%p endfor %}`
```
{%p for service in services %}
{{ service.display_name }}      ← heading
some content paragraph
{%p endfor %}
```
Each directive paragraph must be ALONE (no other text in the same paragraph).

### Table row loop — 3-row pattern
```
Row 0: header (kept)
Row 1: {%tr for item in list %}     ← this row removed at render
Row 2: {{ item.name }} | {{ ... }}  ← data row, REPEATED per item
Row 3: {%tr endfor %}               ← removed at render
```

### Conditional — `{%p if %}` / `{%p endif %}`
```
{%p if feat.preconditions %}
Điều kiện tiên quyết: {{ feat.preconditions }}
{%p endif %}
```

### Image embedding
render_docx.py pre-processes content-data:
- `step.screenshot` (filename) → `step.screenshot_image` (InlineImage object)
- Template references `{{ step.screenshot_image }}` which docxtpl renders as embedded image

## Forking new ETC template version

When ETC releases a new template (BM.QT.04.XX v2):

1. Save source to `templates/source/huong-dan-su-dung-v2.docx`
2. Edit `tools/jinjafy_templates.py` if ETC changed cover/TOC/signing structure
3. Run: `python tools/jinjafy_templates.py hdsd --source templates/source/huong-dan-su-dung-v2.docx`
4. Regression test: `python render_docx.py --template templates/huong-dan-su-dung.docx --data poc/stress-content-data.json --output /tmp/test.docx`
5. If OK, commit both source + jinjafied templates

**Total effort for template upgrade: ~30 minutes.**

## Measured performance (2026-04)

| Input | xlsx fill | docx render |
|---|---|---|
| 5 UI + 3 API TCs | 90 cells, <1s | n/a |
| 30 features stress | n/a | 699 paras, 8 tables, 30 H4 feature headings, <2s |

Both engines run as isolated Python subprocesses — **zero Claude context
consumption** during render.

## Guarantees

- **Styles from template**: docxtpl preserves all paragraph styles from Jinja-tagged template. Tables, headers, footers, signing pages, TOC — all intact.
- **Formulas preserved** (xlsx): schema declares formula cells; openpyxl engine never writes to them.
- **Split-run safe**: docxtpl automatically handles Word's run-splitting issue for `{{ var }}` substitutions.
- **TOC auto-refresh**: post-render hook sets `updateFields=true` + marks TOC fields dirty.
- **Orphan media cleanup**: post-render strips unused images inherited from bloated templates.
- **Deterministic**: same input → same output.

## content-data.json shape

See `agents/tdoc-data-writer.md` for authoritative schema. High-level:

```jsonc
{
  "project":    { "display_name", "code", "client" },
  "dev_unit":   "...",
  "meta":       { "today", "version", "test_period" },
  "overview":   { "purpose", "scope", "system_description",
                  "conventions", "terms": [...], "references": [...] },
  "services":   [ { "slug", "display_name",
                    "features": [ { "id", "name", "description", "actors",
                                    "preconditions", "ui_elements", "steps",
                                    "dialogs", "error_cases" } ] } ],
  "troubleshooting": [...],
  "architecture":    { ... TKKT fields ... },
  "tkcs":            { ... TKCS addenda ... },
  "test_cases":      { "ui": [...], "api": [...] }
}
```

`render_docx.py` auto-computes `all_features` (flat list) for convenience in templates that need cross-service iteration.
