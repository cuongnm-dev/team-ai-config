# Schema Summary — Test Accounts (intel layer)

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/test-accounts.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): HDSD (prerequisites), Cursor /resume-feature QA
> **Writer voice hint**: Reference (credentials per role)

## Purpose

Test accounts for Playwright auth + manual QA. Cross-skill bridge for tdoc-test-runner, resume-feature dispatcher, generate-docs Stage 3a capture. File MUST be .gitignored when storage='inline'. Producer: from-code (extract from seed scripts) OR manual-interview. Consumer: tdoc-test-runner, generate-docs Stage 0.5, resume-feature implement stage.

## Required top-level fields

- `schema_version`
- `storage`
- `accounts`

## Field structure (depth ≤ 2)

- `schema_version` (any) [const='1.0'] **REQUIRED**
- `storage` (string) **REQUIRED** — inline = passwords stored in this file (REQUIRES .gitignore entry). env-ref = passwords resolved at runtime from env vars.
- `gitignore_verified` (boolean) — When storage='inline', producer MUST verify file is in .gitignore and set true. Consumer SHOULD refuse if storage='inline' AND gitignore_verified=false.
- `base_url` (string | null) — Base URL of the running app (e.g. http://localhost:3000). Optional; consumers may override per-run.
- `accounts` (array<object {...}>) [min_items=1] **REQUIRED**
  - **(each array item)**:
    - `role_slug` (string) [pattern='^[a-z][a-z0-9-]*$'] **REQUIRED** — FK → actor-registry.json roles[].slug. Cross-ref enforced by intel-validator.
    - `username` (string) [min_chars=1] **REQUIRED**
    - `password` (string | null) — Plaintext password. ONLY allowed when storage='inline'. MUST be null when storage='env-ref'.
    - `password_ref` (string | null) [pattern='^env://[A-Z_][A-Z0-9_]*$'] — Env var reference, e.g. env://TEST_HQDK_PASSWORD. Required when storage='env-ref'.
    - `login_url` (string | null) — Override actor-registry.roles[].auth.login_url if needed.
    - `post_login_redirect` (string | null) — Expected URL after successful login (used by tdoc-test-runner to confirm login).
    - `storage_state_file` (string | null) — Optional Playwright storage state JSON path (relative to repo). When present, prefer this over username/password.
    - `seed_source` (string | null) — File:line where this account is seeded (e.g. db/seed/test-users.ts:42). Producer evidence.
    - `verified_at` (string | null) [format=date-time] — ISO 8601 timestamp of last successful login verification.
    - `notes` (string | null)

## Critical constraints (quick reference for emit/validate)

- `accounts` — min_items=1
- `accounts[].role_slug` — pattern='^[a-z][a-z0-9-]*$'
- `accounts[].username` — min_chars=1
- `accounts[].password_ref` — pattern='^env://[A-Z_][A-Z0-9_]*$'

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `test-accounts.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/test-accounts.schema.json`