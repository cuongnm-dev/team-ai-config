# Schema Summary — Test Evidence (per feature)

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/test-evidence.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): xlsx (§ entire), TKCT (§8.2)
> **Writer voice hint**: Reference (test case catalog with execution status)

## Purpose

Captured by resume-feature QA stage. Contains Playwright test definitions, execution results, and screenshot map. Consumed by generate-docs Stage 3a (capture) + Stage 4f (xlsx) — generate-docs does NOT re-run Playwright when fresh evidence exists. Layout: one file per feature at docs/intel/test-evidence/{feature-id}.json.

## Required top-level fields

- `schema_version`
- `feature_id`
- `captured_at`
- `test_cases`

## Field structure (depth ≤ 2)

- `schema_version` (any) [const='1.0'] **REQUIRED**
- `feature_id` (string) [pattern='^F-[0-9]{3,}$'] **REQUIRED** — FK → feature-catalog.json features[].id
- `captured_at` (string) [format=date-time] **REQUIRED**
- `captured_by` (string) — Producer: 'resume-feature/qa', 'generate-docs/s3a' (fallback), 'manual'.
- `playwright_config` (object | null)
- `test_cases` (array<object {...}>) [min_items=1] **REQUIRED**
  - **(each array item)**:
    - `id` (string) [pattern='^TC-F-[0-9]{3,}-[0-9]{2,}$'] **REQUIRED** — Test case id format: TC-{feature-id}-NN, e.g. TC-F-001-01
    - `title` (string) [min_chars=10] **REQUIRED**
    - `role_slug` (string) **REQUIRED** — FK → actor-registry.roles[].slug. Determines which test account/storage_state to use.
    - `priority` (string)
    - `type` (string)
    - `preconditions` (array<string>)
    - `steps` (array<object {...}>) [min_items=1] **REQUIRED**
    - `expected_result` (string) [min_chars=10] **REQUIRED** — End-state assertion, the 'PASS criterion'.
    - `execution` (object | null) — Last execution result. Null if test defined but not yet run.
    - `linked_acceptance_criteria_idx` (array<integer>) — Indices into feature-catalog.features[].acceptance_criteria[] this TC validates. Coverage tracking.
- `screenshots` (array<object {...}>) — Captured during test execution. Consumed by generate-docs HDSD writer.
  - **(each array item)**:
    - `id` (string) [pattern='^F-[0-9]{3,}-step-[0-9]{2,}-[a-z_]+$'] **REQUIRED** — Canonical naming: {feature-id}-step-NN-{state}. State vocab: initial|filled|success|error|loading|modal|list|detail|placeholder.
    - `path` (string) **REQUIRED** — Relative path under repo root, e.g. docs/intel/screenshots/F-001-step-01-initial.png
    - `state` (string) **REQUIRED**
    - `viewport` (string)
    - `role_slug` (string)
    - `test_case_id` (string | null)
    - `step_order` (integer | null)
    - `annotation` (string | null) — Optional VN caption for HDSD.
- `coverage` (object | null)
- `freshness` (object {...}) — Used by generate-docs to decide reuse vs re-run.
  - `feature_catalog_hash_at_capture` (string) — sha256 of feature entry when evidence was captured. Mismatch → re-capture needed.
  - `code_hash_at_capture` (string | null) — Optional: sha256 of relevant source files at capture time.

## Critical constraints (quick reference for emit/validate)

- `feature_id` — pattern='^F-[0-9]{3,}$'
- `test_cases` — min_items=1
- `test_cases[].id` — pattern='^TC-F-[0-9]{3,}-[0-9]{2,}$'
- `test_cases[].title` — min_chars=10
- `test_cases[].steps` — min_items=1
- `test_cases[].steps[].action` — min_chars=5
- `test_cases[].expected_result` — min_chars=10
- `screenshots[].id` — pattern='^F-[0-9]{3,}-step-[0-9]{2,}-[a-z_]+$'

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `test-evidence.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/test-evidence.schema.json`