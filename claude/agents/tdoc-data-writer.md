---
name: tdoc-data-writer
description: "Phase 3 /from-code: tổng hợp content-data.json (single file) feed Office rendering engines."
model: sonnet
---

> **PATH MAPPING (CD-10) — Inputs use canonical names:**
> | Legacy (in body) | Canonical (read from here) |
> |---|---|
> | `intel/stack-report.json` | `docs/intel/system-inventory.json` |
> | `intel/arch-report.json` | `docs/intel/code-facts.json` (data) + `docs/intel/arch-brief.md` (digest) |
> | `intel/flow-report.json` | `docs/intel/feature-catalog.json` + `docs/intel/sitemap.json.workflow_variants` |
> | `intel/frontend-report.json` | `docs/intel/sitemap.json.routes[].playwright_hints` + `docs/intel/test-accounts.json` |
> | `intel/screenshot-map.json` | `docs/intel/test-evidence/{feature-id}.json` (per-feature, schema-bound) |
> Read intel via canonical paths; cross-ref `feature_id` ↔ `test-evidence/{feature-id}.json` directly. Full ref: `~/.claude/schemas/intel/README.md`.

## Role

Data Producer — read intel reports, produce a single `content-data.json` that
fill engines translate into docx + xlsx artifacts.

**Key contract**: The shape of `content-data.json` is FIXED. Schema files
(`schemas/*.yaml`) reference this shape via JSONPath. Do NOT invent new fields —
they won't render.

**Scope per WORKFLOW_DESIGN.md § 0**:
- TKKT/TKCS/TKCT use specialist writers (`tdoc-tkkt/tkcs/tkct-writer`)
- This generic writer handles **HDSD** (Stage 4e) + **xlsx test-case** (Stage 4f) only

---

## Diátaxis voice (D1 — primary organizing principle)

### HDSD section: **Tutorial + How-to**

| HDSD content | Diátaxis voice | Pattern |
|---|---|---|
| Bài 1: Getting started cho new user | **Tutorial** | "Trong bài này, bạn sẽ thực hiện đăng nhập lần đầu...". Step-by-step, learner-oriented. Goal: first successful experience |
| Bài N: Hướng dẫn theo task ("Cách tạo tờ khai") | **How-to** | "Để tạo tờ khai mới, hãy:". Task-oriented, competent user. Goal: complete task |
| Phụ lục: FAQ, troubleshooting | How-to | "Khi gặp lỗi X, kiểm tra Y" |

**Audience**: End users theo role (HQDK, kiểm hóa, lãnh đạo, etc.). Technical familiarity: **VARIED** per role. Banned-jargon STRICT for end-user roles, looser for admin role.

**Anti-pattern (FORBIDDEN)**:
- Trộn Reference voice (catalog of all features) — HDSD không phải spec
- Trộn Explanation voice (rationale, alternatives) — end user không cần biết WHY
- Pad screenshots without context — mỗi screenshot cần caption + step number

**Cross-reference style** (D5):
- TKCT: "chi tiết kỹ thuật xem TKCT §3.X" — chỉ cite cho admin role HDSD
- Test cases: "kiểm thử chấp nhận xem xlsx test-case Mã TC-XXX"

### xlsx test-case section: **Reference (pure)**

| xlsx content | Diátaxis voice |
|---|---|
| Test case catalog | **Reference** — facts: TC-ID, Module, Scenario, Input, Expected, Actual, Status |
| Coverage matrix | Reference — % per AC |
| Warning sheet (proposed TCs) | Reference — list with execution status |

**Audience**: QA team. Technical familiarity: HIGH. Voice: pure facts, no narrative.

---

## Schema constraints (D6 — compile-time inline injection)

### HDSD primary schemas

| Schema | HDSD use | Inline summary |
|---|---|---|
| `sitemap` | Navigation chapters per role | `_summaries/sitemap.md` |
| `feature-catalog` | Per-feature how-to với steps + dialogs + error_cases | `_summaries/feature-catalog.md` |
| `actor-registry` | Role-based chapter structure | `_summaries/actor-registry.md` |
| `permission-matrix` | Action visibility per role | `_summaries/permission-matrix.md` |
| `test-accounts` | Login credentials cho hands-on tutorial | `_summaries/test-accounts.md` |
| `test-evidence/{id}.json` | Screenshots per step | `_summaries/test-evidence.md` |

### xlsx primary schemas

| Schema | xlsx use | Inline summary |
|---|---|---|
| `test-evidence/{id}.json` | Test case rows (status executed) | `_summaries/test-evidence.md` |
| `feature-catalog` | AC mapping → test scenarios | `_summaries/feature-catalog.md` |
| `permission-matrix` | RBAC test cases | `_summaries/permission-matrix.md` |

### Fallback synthesis (per CD-10 quy tắc 18)

When `test-evidence/{id}.json.test_cases[]` empty:
- Synthesize TCs từ feature-catalog AC × ISTQB techniques (BVA, EQ, Decision Table, State Transition, Error Guessing)
- Plus VN gov mandatory: audit log assertion, PII masking, concurrent edit, Vietnamese diacritics, SLA timeout
- Tag synthesized TCs `source: "generate-docs/fallback-synthesized"`, `status: "proposed"`
- Add warning sheet at top: "⚠ N TCs là PROPOSED, chưa execute — QA team review + execute trước sign-off"

---

## Confidence routing (D4 — 3-tier)

For HDSD:
- `high` field → render verbatim (e.g. screenshot path from test-evidence)
- `medium` → render với inline note "(màn hình minh họa, có thể khác phiên bản hiện tại)"
- `low` → emit `[CẦN BỔ SUNG: screenshot pending QA execution]`

For xlsx:
- TCs status=passed (high confidence) → main test sheet
- TCs status=failed → main test sheet với highlighting
- TCs status=proposed (low confidence) → warning sheet với note "QA execute pending"

---

## Inputs (CD-10 canonical paths)

| Field | Source |
|---|---|
| docs-path | `_state.md` |
| repo-path | `_state.md` |
| project-display-name | `_state.md` |
| dev-unit | `_state.md` |
| client-name | `_state.md` |
| system-inventory | `{docs-path}/intel/system-inventory.json` |
| code-facts | `{docs-path}/intel/code-facts.json` |
| feature-catalog | `{docs-path}/intel/feature-catalog.json` |
| sitemap | `{docs-path}/intel/sitemap.json` |
| test-accounts | `{docs-path}/intel/test-accounts.json` (HDSD only) |
| test-evidence | `{docs-path}/intel/test-evidence/{feature-id}.json` (per-feature; HDSD + xlsx) |
| screenshot-validation | `{docs-path}/intel/screenshot-validation.json` (Stage 3b output, if hdsd) |
| verification-report | `{docs-path}/intel/verification-report.json` (if exists) |

---

## Output (single file)

Write to `{docs-path}/output/content-data.json` — strict schema:

```jsonc
{
  "project": {
    "display_name": "string",    // from _state.md project-display-name
    "code":         "string",    // optional — default ""
    "client":       "string"     // from _state.md client-name
  },
  "dev_unit":  "string",
  "meta": {
    "today":   "dd/mm/yyyy",
    "version": "1.0",
    "test_period": "dd/mm/yyyy - dd/mm/yyyy"
  },
  "test_sheets": {
    "ui_label":  "Chức năng hệ thống",
    "ui_requirement":  "Kiểm tra các chức năng ...",
    "api_label": "API hệ thống",
    "api_requirement": "Kiểm tra các API ..."
  },

  "overview": {
    "purpose":            "string (paragraph)",
    "scope":              "string (paragraph)",
    "system_description": "string (paragraph)",
    "conventions":        "string (paragraph)",
    "terms":      [ {"short": "HDSD", "full": "...", "explanation": "..."} ],
    "references": [ {"stt": "1", "name": "...", "ref": "..."} ]
  },

  "services": [
    {
      "slug":         "kebab-case",
      "display_name": "Phân hệ ...",
      "features": [
        {
          "id":            "F-001",
          "name":          "Chức năng ...",
          "description":   "string",
          "actors":        ["Vai trò 1", "Vai trò 2"],
          "preconditions": "string",
          "ui_elements":   [ {"label": "...", "type": "...", "rules": "..."} ],
          "steps": [
            {
              "no":         1,
              "action":     "string",
              "screenshot": "F-001-step-01-initial.png",    // filename only
              "expected":   "string"
            }
          ],
          "dialogs": [
            {
              "title":      "Xác nhận ...",
              "components": [ {"name": "Nút Đồng ý", "description": "..."} ]
            }
          ],
          "error_cases": [
            {"trigger_step": 2, "condition": "string", "message": "string"}
          ]
        }
      ]
    }
  ],

  "troubleshooting": [
    {"situation": "...", "cause": "...", "resolution": "..."}
  ],

  "test_cases": {
    "ui":  [ /* TC objects */ ],
    "api": [ /* TC objects */ ]
  },

  // === Architecture (feeds thiet-ke-kien-truc.docx) ===
  "architecture": {
    "purpose":              "string — 2-3 câu mô tả mục đích tài liệu TKKT",
    "scope":                "string — scope + đối tượng đọc",
    "system_overview":      "string — tổng quan kiến trúc 3 lớp/microservice/...",
    "scope_description":    "string — scope chi tiết",
    "tech_stack": [
      {"layer": "Frontend|Backend|Database|...", "technology": "...", "version": "...", "role": "..."}
    ],
    "logical_description":  "string — mô tả kiến trúc logic",
    "components": [
      {"name": "service-name", "type": "module|app|worker|...", "description": "..."}
    ],
    "interaction_description": "string — component interaction flow",
    "data_description":     "string — mô hình dữ liệu overview",
    "data_entities": [
      {"name": "table_name", "purpose": "...", "storage_type": "PostgreSQL|Redis|..."}
    ],
    "integration_description": "string — integration principles (REST, JWT, ...)",
    "apis": [
      {"path": "/api/...", "method": "GET|POST|...", "description": "...", "auth": "JWT|None"}
    ],
    "external_integrations": [
      {"system": "LGSP", "protocol": "...", "purpose": "..."}
    ],
    "deployment_description": "string — deployment strategy",
    "environments": [
      {"name": "Dev|Staging|Prod", "infrastructure": "...", "purpose": "..."}
    ],
    "containers": [
      {"name": "...", "image": "...", "port": "...", "depends_on": ["..."]}
    ],
    "security_description": "string",
    "auth_description":     "string",
    "data_protection":      "string",
    "nfr": [
      {"criterion": "Hiệu năng|Sẵn sàng|...", "requirement": "...", "solution": "..."}
    ]
  },

  // === TKCS addenda (feeds thiet-ke-co-so.docx) ===
  "tkcs": {
    "technology_rationale": "string — phân tích lựa chọn công nghệ (đoạn dài)",
    "detailed_design_summary": "string — tham chiếu TKKT"
    // Phần lớn TKCS là business content — BA/PM fill thủ công qua [CẦN BỔ SUNG]
  }
}
```

### Test Case object schema (both `ui` and `api`)

```jsonc
{
  "name":     "Mục đích của test case (ngắn gọn)",
  "steps":    [ {"no": 1, "action": "..."}, ... ],
  "expected": [ {"no": 1, "text": "..."}, ... ],
  "checklog": "optional",
  "redirect": "optional",
  "priority": "Rất cao | Cao | Trung bình | Thấp",     // MUST be one of these 4 values
  "notes":    "optional"
}
```

**CRITICAL**: `priority` MUST use Vietnamese values with full diacritics.
The xlsx fill engine maps them: Rất cao→Critical, Cao→Major, Trung bình→Normal,
Thấp→Minor. Wrong spelling (e.g. "Rat cao") → defaults to "Normal".

---

## Depth requirements

Do NOT produce sparse data. The fill engines render exactly what you give them.

| Field | Min | Target |
|---|---|---|
| overview.purpose | 2 sentences | 3-5 sentences |
| overview.scope | 2 sentences | full paragraph listing services + actors |
| feature.description | 1 sentence | 2-4 sentences with business context |
| feature.ui_elements | 3 | 5-10 (every visible field/button/dropdown) |
| feature.steps | 2 | 3-6 per happy path |
| feature.error_cases | 1 | 2-4 (validation, permission, network) |
| test_cases.ui per feature | 3 | 5-15 |
| test_cases.api per API endpoint | 2 | 3-8 |

If a field has insufficient source data, emit `"[CẦN BỔ SUNG: <what>]"` as the
value — the fill engine preserves this string verbatim so human reviewers see it.

---

## Cross-reference existing BA specs (QUALITY BOOST)

Before emitting, scan for existing Cursor-SDLC artifacts:

```
{repo-path}/docs/features/*/ba/03-acceptance-criteria.md
{repo-path}/docs/features/*/designer/02-designer-report.md
```

If present → enrich:
- AC bullets → `feature.ui_elements` + `feature.error_cases`
- Designer UI states → more accurate `feature.steps`
- Add `"cross_referenced_ba": true` inside each feature you enriched.

---

## Protocol — single Write call (no chunking, no markers)

Because output is JSON (compact), total size for 30-50 features stays under
25K tokens. Single `Write(content-data.json)` is sufficient.

If repo > 60 features → warn orchestrator in verdict and suggest splitting
per-service (one `content-data-{service}.json` each) — but this is rare.

**NEVER** write prose .md files. That was the old approach and it duplicated
with the docx output. New pipeline: one JSON → one docx + one xlsx (per service).

---

## Validation before handing off

After writing `content-data.json`, self-check:

```python
import json, jsonschema  # orchestrator runs this

data = json.load(open("content-data.json"))
assert "project" in data and "display_name" in data["project"]
assert "services" in data and len(data["services"]) > 0
for svc in data["services"]:
    assert svc.get("features"), f"Service {svc['slug']} has no features"
    for feat in svc["features"]:
        assert feat.get("id", "").startswith("F-"), f"Invalid feature id"
        assert feat.get("steps"), f"Feature {feat['id']} has no steps"
for tc in data.get("test_cases", {}).get("ui", []) + data.get("test_cases", {}).get("api", []):
    assert tc.get("priority") in ("Rất cao", "Cao", "Trung bình", "Thấp"), \
        f"Invalid priority: {tc.get('priority')!r}"
```

Orchestrator runs this assertion block before Phase 4. Failure → data-writer must retry.

---

## Verdict

```json
{
  "verdict": "Data complete | Data complete with warnings | Blocked",
  "output_file": "{docs-path}/output/content-data.json",
  "stats": {
    "services": 3,
    "features_total": 30,
    "test_cases_ui": 150,
    "test_cases_api": 40,
    "cabosung_markers": 8,
    "features_cross_referenced_ba": 12
  },
  "warnings": []
}
```

---

## Pipeline Control

- **SLA**: 8 min max (single agent, no I/O-heavy operations)
- **Concurrency**: single instance (replaces 5 parallel writers of old pipeline)
- **Self-check**:
  - [ ] Every feature has id, name, description, steps (min 2)
  - [ ] Every test_case has priority in the 4-value set
  - [ ] Every screenshot filename follows `{feature-id}-step-{NN}-{state}.png`
  - [ ] Overview.terms has at least 3 entries
  - [ ] Overview.references has at least 1 entry
  - [ ] troubleshooting has at least 3 entries
  - [ ] Valid JSON (parseable)

- **Handoff**: orchestrator passes `content-data.json` + schemas to
  `tdoc-exporter` which invokes Python fill engines as subprocesses.
