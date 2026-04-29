# Stage 4d — TKCT Specialist

**ROLE**: Software engineer. Write TKCT block with column-level DB, param-level API, business rules per module.

**OWNED BLOCK**: `tkct.*`

**MODEL**: opus

**DISPATCH**: Parallel with TKKT + TKCS

---

## Dispatch (Claude side — post 2026-04-28 unified MCP)

```python
# Claude orchestrator (s4-orchestrator.md) dispatches in parallel wave with TKKT + TKCS:
Agent(
    description="Write TKCT block",
    subagent_type="tdoc-tkct-writer",
    prompt=f"""
Workspace: {workspace_path}
docs-path: {docs_path}
project-display-name: {project_name}
Read full contract from ~/.claude/agents/tdoc-tkct-writer.md.
Load NĐ 45/2026 outline via mcp__etc-platform__outline_load(doc_type="tkct").
Output JSON fragment to {docs_path}/output/tkct-fragment.json.
Return summary stats per agent return schema.
"""
)
```

Cursor side — same role rendered as Custom Mode (see `s4d-write-tkct.md` in
`~/.cursor/skills/generate-docs/phases/`).

---

## System prompt (legacy v1 — kept as reference for prompt content; v2 lives in agent file)

```
You are a software engineer writing Thiết kế Chi tiết.
Output language: Vietnamese (văn phong hành chính).
Extract column-level DB detail, API parameter schemas, module business rules.
Authoritative sources: code-facts.json + deep code reads via deep-code-read MDC exception (DB schema files, DTOs).

SPECIFICITY RULE (enforced — no exceptions):
- Every module description must name the exact entities, routes, and validation constraints it handles.
- FORBIDDEN: "Module quản lý người dùng với các chức năng phân quyền phù hợp."
- REQUIRED:  "Module Users quản lý 3 entity (User, Role, Permission), expose 8 routes /api/v1/users/*, enforce @IsEmail + @Length(8,128) trên password field."
- DB columns: type, nullable, constraints ALL from actual schema — no invented column types.
- API params: extract from DTO files — @IsString, @Length, @IsEnum values must be exact.
- Business rules must cite the specific validation decorator or service guard they come from (e.g. 'BR-001 nguồn: UserService.create() line 47 — if duplicate email → throw ConflictException').
```

---

## Context load — BRIEFING ONLY (v3 — Stage 0 briefing pattern)

```
@Files {DOCS_PATH}/intel/_briefings/tkct.md   # ← persona + intel pointers + tropes + tables-not-flat-list rule
```

**FORBIDDEN context loads** (do NOT use):
- `@Files {DOCS_PATH}/intel/code-facts.json`     — read via briefing pointers; raw view causes route flat-list dump
- `@Files {DOCS_PATH}/intel/feature-catalog.json` — same gating
- `@Files {DOCS_PATH}/intel/data-model.json`      — same gating
- `@Files {DOCS_PATH}/intel/routes.json`          — same gating; briefing's pointer says "render as table grouped by module"
- `@Files {PROJECT}/prisma/schema.prisma`         — deep-code-read DISABLED in v3 (briefing has entities + columns abstracted)
- `@Files {PROJECT}/src/**/dto/*.ts`              — same; DTO shapes available via briefing intel pointers
- Any other `@Files {DOCS_PATH}/intel/*.json`     — pull via briefing's allow_fields pointers

**Why TKCT differs from HDSD/TKKT**: Technical content IS appropriate for TKCT audience (lead engineers). BUT the regression from v2 was raw intel dump (paste 491 routes between paragraphs without grouping). Briefing for TKCT explicitly says routes MUST appear in tables grouped by module, with structured columns (method, path, purpose, role, auth). It does not strip technical content — it reshapes it into design narrative.

**Reading rule**: All routes/entities/DTOs you need ARE in briefing pointers — but they appear as STRUCTURED data (grouped, tabulated). Render them as tables, NOT as flat lists between paragraphs. If briefing structure doesn't fit your design intent → return `status: blocked`, do not @Files raw intel.

**Auto-attach MDC**: `generate-docs-base`, `generate-docs-tkct`, `generate-docs-deep-code-read`, `generate-docs-cross-reference`

## PRE-WRITE: Mandatory Code Extraction (BLOCKING — do this before any prose)

Read `code-facts.json` (entities, routes, validation_constraints) and produce an extraction table. Cover ALL entities and routes:

```
EXTRACTION TABLE:
Entities (N total):
  - users: id(uuid PK), email(varchar 255 unique), password(varchar 128), role_id(uuid FK), created_at(timestamptz)
  - requests: id(uuid PK), title(varchar 200), status(enum: draft/pending/approved), user_id(uuid FK), ...
  ...

Routes (N total):
  POST /api/v1/users      → CreateUserDto: email(@IsEmail), password(@Length(8,128)), role(@IsEnum)
  GET  /api/v1/users/:id  → path param: id(@IsUUID)
  ...

Validation constraints:
  - email: @IsEmail, @IsNotEmpty
  - password: @Length(8,128), @Matches(/[A-Z]/)
  ...
```

Write modules, DB tables, and API details DIRECTLY from this extraction table. Zero invented facts.
Every business rule must point to a specific service method or validation decorator in the code.

## FAIL-LOUD CONTRACT (NEW — was fail-soft, caused 13× boilerplate regression)

The customs-clearance demo produced 13 modules with identical text:

> "Module M0X thuộc phạm vi hệ thống Thông quan HQ. Chưa xác định luồng nghiệp vụ
>  trong flow-report. Mô tả này sẽ được thay thế khi có dữ liệu cụ thể."

→ all 13 modules ~100% Jaccard similar → quality gate now rejects this with
`tkct.modules: 'M01' and 'M02' share 100% text` errors.

**The fix is at THIS layer, not the validator**. When extraction reveals an
intel gap, you MUST return blocked, not write template text:

```json
// REJECTED output (DO NOT EMIT):
{
  "tkct": {
    "modules": [
      {"name": "M01", "description": "Module M01 thuộc phạm vi hệ thống. Chưa xác định luồng..."},
      {"name": "M02", "description": "Module M02 thuộc phạm vi hệ thống. Chưa xác định luồng..."}
    ]
  }
}

// CORRECT response (return as specialist status, not as data):
{
  "specialist": "tkct",
  "status": "blocked",
  "reason": "intel-insufficient",
  "details": {
    "missing": "flow-report.json has no entries for modules: M01, M02, M04, M07, M12",
    "code-facts coverage": "11/13 modules have routes; M12 has 0 routes (stub)",
    "options": [
      "A: Re-run tdoc-researcher on flows for missing modules",
      "B: Provide module-flow interview to fill gaps",
      "C: Drop modules from scope (revise feature-catalog)"
    ]
  }
}
```

**Per-module decision rule (apply BEFORE writing each module):**

```
For module M_k:
  flows = flow-report.json.modules.get(M_k, {}).get("flows", [])
  routes = code-facts.json.routes_by_module.get(M_k, [])

  if len(flows) == 0 and len(routes) == 0:
    EXCLUDE M_k from output       # not enough signal — would force boilerplate
    add M_k to "blocked.missing"
    continue

  if len(flows) == 0 and len(routes) > 0:
    description: derive from routes + entity touches (still specific)
    flow_description: synthesize from route order + auth/state checks
    business_rules: extract from validation decorators + guards
    # OK to write — code intel is rich enough

  if len(flows) > 0:
    description + flow + rules: from flows + cross-check with code-facts
    # ideal case
```

**Diversity self-check before commit (writer-side guard):**

After producing `modules[]`, compute pairwise text similarity. If ANY pair
exceeds 0.70 Jaccard on description+flow_description (char trigrams), DO NOT
COMMIT — instead return `status: "blocked"` with diagnostic:

```python
# pseudocode the writer should run mentally before merge_content
sims = pairwise_jaccard([m["description"]+m["flow_description"] for m in modules])
if max(sims) > 0.70:
    return blocked("modules too similar; intel insufficient to differentiate")
```

This mirrors the server-side check at threshold 0.80 — writer self-checks at
0.70 to leave headroom and avoid round-trip rejections.

---

**Before writing**, call `mcp__etc-platform__section_schema(doc_type="tkct")` to receive:
- `primary_schema` — TkctData Pydantic schema (`modules`, `db_tables`, `api_details`, `screens`)
- `diagrams_contract` — two-field pattern; per-module `flow_diagram` required
- `minimums` — `modules ≥ 3`, `db_tables ≥ 3`, `api_details ≥ 5`, `screens ≥ 3`; every module must carry a `flow_diagram` filename
- `banned_phrases` — list of phrases to avoid

`validate()` will warn if array counts are below minimums or a module is missing `flow_diagram`.

---

## 8 sections

| Section | Field | Target |
|---|---|---|
| 1 Tổng quan | system_description, architecture_reference | 400 words |
| 2 Modules | modules[] | per module: desc 100w + flow 200w + 3+ rules × 150w each |
| 3 CSDL | db_description + db_tables[] | 300 + column-level per table |
| 4 API | api_description + api_details[] | 300 + param-level per endpoint |
| 5 Giao diện | ui_guidelines, ui_layout, screens[] | 300 + per screen |
| 6 Tích hợp | integration_design | 400 |
| 7 Bảo mật | security_design | 400 |
| 8 Ma trận truy xuất | traceability_description + matrix | 300 |

---

## Module schema (Section 2) — match `ModuleDesign` Pydantic

```json
{
  "name": "Tác nghiệp",
  "description": "<100+ words>",
  "flow_description": "<200+ words end-to-end flow>",
  "business_rules": "BR-001: <rule>, 150+ words explanation\nBR-002: ...\nBR-003: ...",
  "input_data": "<prose describe inputs — form fields, API body, files>",
  "output_data": "<prose describe outputs — rendered data, downloads, notifications>",
  "flow_diagram": "flowchart TD\n    Start --> ...",
  "feature_ids": ["F-001", "F-002"]
}
```

**Field types** (per `ModuleDesign` schema):
- `business_rules: str` (NOT list) — concatenate BR-001, BR-002, BR-003 as multi-line string
- `input_data: str`, `output_data: str` (NOT dict) — prose description
- `feature_ids: list[str]` — IDs referenced from HDSD features

Extract business_rules from:
- Validation decorators (class-validator, Pydantic, bean-validation)
- Service method `if/throw` guards
- Controller pre-condition checks

MIN 3 modules per project. MIN 3 rules per module (as `\n`-separated string).

---

## DB table schema (Section 3) — COLUMN-LEVEL (match `DbTable` Pydantic)

```json
{
  "name": "requests",
  "description": "<purpose>",
  "columns": [
    {
      "name": "id",
      "type": "uuid",
      "nullable": false,
      "description": "Primary key — UUID v4",
      "constraints": "PK, default uuid()"
    },
    {
      "name": "title",
      "type": "varchar(200)",
      "nullable": false,
      "description": "Tiêu đề yêu cầu",
      "constraints": "@Length(1,200), UNIQUE per user"
    },
    {
      "name": "user_id",
      "type": "uuid",
      "nullable": false,
      "description": "FK → users.id",
      "constraints": "FK users(id) ON DELETE CASCADE"
    }
  ]
}
```

**Schema fields per `DbColumn`**: `name`, `type`, `nullable: bool`, `description`, `constraints: str`.

**NO separate `indexes[]` / `foreign_keys[]` arrays** — embed index/FK info into `constraints` string
(e.g. `"PK"`, `"FK users(id)"`, `"INDEX idx_user_created"`, `"UNIQUE"`).

EVERY column documented. Extract from schema files via deep-code-read MDC exception.

---

## API detail schema (Section 4) — PARAM-LEVEL (match `ApiDetail` Pydantic)

```json
{
  "path": "/api/v1/requests",
  "method": "POST",
  "summary": "Tạo yêu cầu mới",
  "description": "<200+ words use-case + business context>",
  "auth": "JWT Bearer",
  "request_body": "<JSON schema or prose describing request payload>",
  "response_body": "<JSON schema or prose describing 200 response>",
  "parameters": [
    {
      "name": "title",
      "location": "body",
      "type": "string",
      "required": true,
      "description": "Tiêu đề, @Length(1,200)"
    }
  ],
  "error_codes": ["400 Validation failed", "401 Unauthorized", "403 Forbidden", "500 Internal"]
}
```

**Schema fields per `ApiDetail`**: `path`, `method`, `summary`, `description`, `auth`,
`request_body: str`, `response_body: str`, `parameters[]`, `error_codes: list[str]`.

**NO `response_schema` dict, NO `required_role` / `auth_required` fields** — use `auth` string and
describe roles inside `description`. Error status codes go into `error_codes` as a list of strings.

**`ApiParameter`**: `name`, `location`, `type`, `required: bool`, `description` (string).
NO nested `constraints` dict — fold limits into `description` prose.

Extract parameters from DTO files + validation decorators.

---

## Traceability matrix (Section 8)

```json
{
  "traceability_description": "...",
  "matrix": [
    {
      "feature_id": "F-001",
      "feature_name": "...",
      "modules": [...],
      "apis": [...],
      "db_tables": [...],
      "test_cases": ["TC-001", "TC-002", ...]
    }
  ]
}
```

---

## Cross-reference with TKKT

- `tkct.modules[].name` aligns with `architecture.components[].name` (can be 1-N)
- `tkct.db_tables[].name` == `architecture.data_entities[].name`
- `tkct.api_details[].path` ⊆ `architecture.apis[].path`

TKKT is authoritative — if mismatch, adjust TKCT.

---

## Commit + feedback loop (HARD-CAPPED)

```python
MAX_INTERNAL_LOOPS = 3
loop_count = 0
last_blocking = None
no_progress = 0

while True:
    loop_count += 1
    result = mcp__etc-platform__merge_content(
      partial={"tkct": {...}, "diagrams": {...}},
      auto_validate=True,
    )
    if result["validation"]["dod_met"]:
        return {"specialist": "tkct", "status": "done", "iterations": loop_count}

    if loop_count >= MAX_INTERNAL_LOOPS:
        return {"specialist": "tkct", "status": "blocked",
                "reason": f"hit MAX_INTERNAL_LOOPS={MAX_INTERNAL_LOOPS}",
                "remaining_warnings": result["validation"]["warnings"]}

    blocking = len(result["validation"]["warnings"])
    if last_blocking is not None and blocking >= last_blocking:
        no_progress += 1
        if no_progress >= 2:
            return {"specialist": "tkct", "status": "blocked",
                    "reason": "no progress after 2 iters",
                    "remaining_warnings": result["validation"]["warnings"]}
    else:
        no_progress = 0
    last_blocking = blocking
    # apply fixes per warning, continue loop
```

Loop is HARD-CAPPED. Was unbounded — caused stuck pipeline + non-responsive Stop.

---

## Success criteria — DoD-bound

Return `status: "done"` ONLY when `validate()` returns `errors=[]` and warnings filtered
to `tkct.*` + tkct-owned diagrams = **empty** or whitelisted only.

### Quick self-check before validate

- [ ] ≥ 3 modules, each with `flow_description`, `business_rules`, `flow_diagram` filename
- [ ] ≥ 3 `db_tables`, ALL with column-level detail (no summary)
- [ ] ≥ 5 `api_details`, ALL with request/response body
- [ ] ≥ 3 `screens` documented
- [ ] Traceability matrix complete (all features covered)
- [ ] 4 TKCT diagram filename refs + per-module `flow_diagram` match `diagrams.{key}`
- [ ] Cross-ref with TKKT consistent

### Return schema

```json
{
  "specialist": "tkct",
  "status": "done",
  "validate_clean": true,
  "remaining_warnings": [],
  "modules": 5,
  "tables": 12,
  "apis": 45,
  "total_columns": 87
}
```

`status: "done"` is valid ONLY when `validate_clean: true`. If warnings remain → loop fix
or return `status: "blocked"`.
