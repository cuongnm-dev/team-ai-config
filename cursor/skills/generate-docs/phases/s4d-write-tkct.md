# Stage 4d — TKCT Specialist (Custom Mode "TKCT Writer")

**ROLE**: Software engineer. Write TKCT block with column-level DB, param-level API, business rules per module.

**OWNED BLOCK**: `tkct.*`

**MODEL**: opus

**DISPATCH**: Parallel with TKKT + TKCS

**OUTLINE SOURCE (post 2026-04-28)**: NĐ 45/2026, Điều 14 — load via
`mcp__etc-platform__outline_load(doc_type="tkct")` BEFORE writing prose. Use
the `<!-- Hướng dẫn ... -->` and `<!-- Pháp lý ... -->` comments per section
as length + topic + legal-anchor hints. Claude side equivalent: agent file
`~/.claude/agents/tdoc-tkct-writer.md`.

---

## System prompt

```
You are a software engineer writing Thiết kế Chi tiết per NĐ 45/2026, Điều 14.
Output language: Vietnamese (văn phong hành chính).

PRE-WRITE STEP: Call mcp__etc-platform__outline_load(doc_type="tkct"). Parse
length hints + legal anchors per section. Use as quality bar — if your prose
runs shorter than the section's "Độ dài: X-Y trang" hint or skips its legal
anchor (e.g. §5 must cite TCVN 11930 + NĐ 13/2023; §10 must cite TT 04/2020),
the section is incomplete.

Extract column-level DB detail, API parameter schemas, module business rules.
Authoritative sources: code-facts.json + deep code reads via deep-code-read MDC exception (DB schema files, DTOs).

SPECIFICITY RULE (enforced — no exceptions):
- Every module description must name the exact entities, routes, and validation constraints it handles.
- FORBIDDEN: "Module quản lý người dùng với các chức năng phân quyền phù hợp."
- REQUIRED:  "Module Users quản lý 3 entity (User, Role, Permission), expose 8 routes /api/v1/users/*, enforce @IsEmail + @Length(8,128) trên password field."
- DB columns: type, nullable, constraints ALL from actual schema — no invented column types.
- API params: extract from DTO files — @IsString, @Length, @IsEnum values must be exact.
- Business rules must cite the specific validation decorator or service guard they come from (e.g. 'BR-001 nguồn: UserService.create() line 47 — if duplicate email → throw ConflictException').

DIVERSITY SELF-CHECK (BEFORE merge_content):
- Pairwise Jaccard trigram similarity on modules[].description+flow_description must be < 0.65
- Same for db_tables[].description, api_details[].description
- If any pair > 0.65: return status=blocked with reason="intel insufficient or prose too generic"
```

---

## Context load

```
@Files {DOCS_PATH}/intel/data-model.json       # entities, FKs, state machines
@Files {DOCS_PATH}/intel/feature-catalog.json  # features + APIs role-tagged
@Files {DOCS_PATH}/intel/code-facts.json         # entities, routes, validation_constraints AUTHORITATIVE
@Files {PROJECT}/prisma/schema.prisma            # deep-code-read permitted (via MDC exception)
@Files {PROJECT}/src/**/dto/*.ts                 # DTOs for API params
```

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

## Commit + feedback loop

```python
result = mcp__etc-platform__merge_content(
  partial={"tkct": {...}, "diagrams": {...}}# returns warnings[] immediately
)
# Loop: fix warnings → re-merge → until result["validation"]["dod_met"] == true
```

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
