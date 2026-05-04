---
description: Đọc mã nguồn dự án để tự động trích xuất features, dựng sơ đồ kiến trúc, sinh hồ sơ feature trạng thái implemented. Output docs/intel/{system-inventory, code-brief, arch-brief, actor-registry, permission-matrix, sitemap, feature-catalog, data-model, integrations}.json + 1 _state.md mỗi feature.
---

# /from-code {repo-path?}

Code-driven pipeline: đọc code → reverse-engineer features.

User-facing: Vietnamese.

## Phase 1 — Discovery

1. Detect stack (package.json, pyproject.toml, go.mod, etc.)
2. Detect monorepo (nx.json, lerna.json, pnpm-workspace.yaml)
3. Run code-harvester (deterministic extraction via tree-sitter, scc, ctags, grep)
4. Outputs:
   - `docs/intel/system-inventory.json` (modules, services, layers)
   - `docs/intel/code-facts.json` (raw symbol table)

## Phase 1.5 — Actor enumeration

`tdoc-actor-enum` equivalent (Cascade loads):
- Extract roles from auth code (decorators, RBAC config)
- Detect RBAC mode (RBAC / ABAC / hybrid)
- Draft `docs/intel/actor-registry.json`
- Draft `docs/intel/permission-matrix.json` from auth checks

## Phase 2 — Analysis

Cascade `tdoc-researcher` equivalent:
- 4 sub-phases: SCAN → ARCH → FLOW → FE
- Outputs:
  - `docs/intel/sitemap.json` (routes + Playwright hints + workflow variants)
  - `docs/intel/arch-brief.md`
  - `docs/intel/code-brief.md`
  - `docs/intel/data-model.json`
  - `docs/intel/integrations.json`
  - `docs/intel/api-spec.json`

## Phase 3 — Feature synthesis

Synthesize features from code patterns:
- Endpoint clusters → feature candidates
- Page routes → frontend feature candidates
- Domain entities + flows → workflow features
- Output: `docs/intel/feature-catalog.json` with `status: implemented`, `confidence: high|medium|low` per evidence strength

## Phase 4 — Validation (code-intel-validator)

Hậu kiểm: silent failures, hallucination, gap coverage, orphan entities, cross-file inconsistency. Output `validation-report.json`.

## Phase 5 — Per-feature state seed

For each feature in catalog:
- Create `docs/features/{feature-id}/_state.md` with `status: implemented`, `source-type: code-reverse-engineered`, `closed-by: from-code`, `closed-at: {today}`

## Phase 6 — Test evidence extraction (CD-10 Q.14)

Extract existing test files (Jest `describe/it`, Pytest `test_*`, Playwright `test()`) → populate `docs/intel/test-evidence/{feature-id}.json` with `status: existing`, `source: from-code/extracted`.

## Phase 7 — Snapshot regen

`python ~/.ai-kit/scripts/intel-snapshot/generate.py --intel-path docs/intel`

## Phase 8 — Quality gate (per CD-10 Q.11)

Hard-stop if `feature-catalog.json` missing OR fields thin:
- description < 200 chars
- business_intent < 100 chars
- flow_summary < 150 chars
- acceptance_criteria < 3 items

If thin → suggest `/intel-fill` (interview) before downstream skills consume.

## Hand off

User chooses:
- `/generate-docs` to render Office docs from intel
- `/audit` for adversarial review
- Manual review of intel JSONs

## What's next

| Outcome | Next |
|---|---|
| Intel + features extracted | `/generate-docs` for Office output |
| Fields thin | `/intel-fill` to interview gaps |
| Issues found | `/audit` |
