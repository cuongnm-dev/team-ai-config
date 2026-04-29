# Schema Summary — Intel Layer Meta

> **AUTO-GENERATED** by `extract_schema_summary.py` at 2026-04-28T16:26:55Z.
> **DO NOT EDIT** — edit canonical schema instead, then re-run script.
> **Source**: `~/.claude/schemas/intel/_meta.schema.json` (schema_version: `1.0`)
> **Consumed by** (Diátaxis tag — D1): all consumers (staleness/lock arbiter)
> **Writer voice hint**: Internal — not directly rendered to docs

## Purpose

Provenance, TTL, staleness, and lock registry for all intel artifacts. Single arbiter for reuse decisions across from-doc, from-code, generate-docs.

## Required top-level fields

- `schema_version`
- `workspace_slug`
- `artifacts`

## Field structure (depth ≤ 2)

- `schema_version` (string) [const='1.0'] **REQUIRED**
- `workspace_slug` (string) [pattern='^[a-z0-9-]+$'] **REQUIRED**
- `created_at` (string) [format=date-time]
- `updated_at` (string) [format=date-time]
- `artifacts` (object) **REQUIRED**
- `reuse_policy` (object {...})
  - `from_doc_to_generate_docs` ($ref:reuseMode)
  - `from_code_to_generate_docs` ($ref:reuseMode)
  - `generate_docs_to_from_doc` ($ref:reuseMode)
  - `generate_docs_to_from_code` ($ref:reuseMode)
  - `from_doc_from_code_merge` ($ref:reuseMode)
- `lock_file` (object {...}) — Optional cooperative lock when multiple skills write concurrently.
  - `held_by` (string)
  - `acquired_at` (string) [format=date-time]
  - `expires_at` (string) [format=date-time]

## Reusable definitions

#### `$artifactMeta`
**Fields**:
- `producer` (string) **REQUIRED**
- `produced_at` (string) [format=date-time] **REQUIRED**
- `ttl_days` (integer) [min=1, max=365] **REQUIRED**
- `checksum_sources` (string) — sha256 of concatenated source files at produce-time. Mismatch = stale.
- `source_evidence` (array<string>) — Paths to source files (docs or code) that fed this artifact.
- `merged_from` (array<string>) — Producer tags of contributors when artifact is multi-producer.
- `stale` (boolean)
- `stale_reason` (string)
- `stale_since` (string) [format=date-time]
- `auto_regen_eligible` (boolean)
- `manual_edits` (array<object {...}>)
  - **(each array item)**:
    - `edited_at` (string) [format=date-time] **REQUIRED**
    - `edited_by` (string)
    - `fields` (array<string>) **REQUIRED**
- `locked_fields` (array<string>) — JSONPath expressions producers must NOT overwrite (e.g. '$.roles[*].display').
- `validation` (object {...})
  - `validated_at` (string) [format=date-time]
  - `validator_version` (string)
  - `errors` (array<string>)
  - `warnings` (array<string>)

#### `$reuseMode`
**Enum**: 'reuse_if_fresh', 'reuse_with_verify', 'merge', 'regenerate', 'never_reuse'

## Critical constraints (quick reference for emit/validate)

- `workspace_slug` — pattern='^[a-z0-9-]+$'

---

**Sub-agent prompt usage** (D6 — compile-time inline injection):

Embed this summary verbatim trong sub-agent prompt khi sub-agent emit `_meta.json`.
Output JSON MUST match constraints listed above. Run validate.py post-hoc.

For full schema: `~/.claude/schemas/intel/_meta.schema.json`