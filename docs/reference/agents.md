---
title: Agents — Stage + Class A/B/C/D
order: 23
---

# Agents Reference

Tất cả agents tuân thủ **LIFECYCLE.md contract** — mỗi agent có ROLE, READ-GATES, OWN-WRITE, ENRICH, FORBID, EXIT-GATES rõ ràng.

Full contract: `claude/schemas/intel/LIFECYCLE.md` §5.

## Production-line metaphor

```
Skill      = khâu trên dây chuyền
Agent      = nhân viên trong khâu
Intel      = hồ sơ work-in-progress
Tokens     = vật tư (đắt khi sai/redo)
```

9 nguyên tắc (P1-P9):
1. Single-writer per field per stage
2. Read-validate-write
3. No re-discovery (reuse-first)
4. No silent drift (flag, không tự fix)
5. Stale-block (artifact stale → STOP)
6. Information sufficiency (đủ + chính xác)
7. Anti-fishing (không scan khi có lookup)
8. Role refusal (ngoài scope → escalate)
9. Context economy (minimum context)

## Stage agents (Cursor SDLC)

### `ba` / `ba-pro` (LIFECYCLE §5.2)
Elaborate description, AC, business rules cho 1 feature.

- **READ**: feature-brief, feature-catalog[id], actor-registry
- **WRITE**: `ba/00-lean-spec.md` + ENRICH feature-catalog (description ≥200, AC ≥3×30, business_rules)
- **FORBID**: routes, entities, permissions, tests, status=implemented

### `sa` / `sa-pro` (§5.3)
Design routes, entities, integrations, concrete permissions.

- **READ**: ba output, feature-catalog (post-ba), data-model, integrations, sitemap, permission-matrix
- **WRITE**: `sa/00-lean-architecture.md`
- **ENRICH**: sitemap.routes (concrete), permission-matrix.permissions (action enum), data-model.entities, integrations
- **FORBID**: AC/business_rules, test-evidence, modify roles[]

### `qa` / `qa-pro` (§5.4)
Execute test cases — atomic triple (TC + Playwright + screenshots).

- **READ**: tech-lead-plan, feature-catalog (AC + routes), sitemap, permission-matrix, test-accounts
- **WRITE**: `07-qa-report.md`, `test-evidence/{id}.json`, `playwright/{id}.spec.ts`, `screenshots/`
- **FORBID**: write AC, fabricate khi catalog rỗng, set feature.status=implemented

### `dev` / `dev-pro` / `fe-dev` (§5.6)
Implement code per tech-lead-plan; trigger intel-drift khi touch auth/role/route/RBAC.

- **READ**: tech-lead-plan, feature-catalog, sitemap, permission-matrix, data-model
- **WRITE**: `/src/**/*` per task, `05-dev-w{N}-{task}.md`
- **UPDATE**: `_state.md.intel-drift: true` (when applicable)
- **FORBID**: edit sitemap/permission-matrix/data-model directly

## Class contracts (LIFECYCLE §5.8-§5.11)

Agents nhỏ hơn được nhóm thành 4 classes — cùng pattern, khác mục đích.

### Class A — Stage-report writers (NO intel writes)

`tech-lead`, `reviewer`, `reviewer-pro`, `designer`, `devops`, `release-manager`

- Đọc upstream stage outputs
- Write 1 file: `04-tech-lead-plan.md` / `08-review-report.md` / etc.
- **FORBID** any `docs/intel/*` write

### Class B — Verifiers (read intel, flag drift, NO fix)

`security`, `data-governance`, `sre-observability`

- Cross-check code vs intel
- Output findings + `_state.md.intel-drift: true`
- **FORBID** modify intel (refer to `/intel-refresh`)
- **EXCEPTION**: Class B được phép scan `/src` (re-extraction là JOB)

### Class C — Orchestrators (control flow only)

`dispatcher`, `pm`, `telemetry`

- Route work, escalate, log
- Update `_state.md` (current-stage, completed-stages, kpi)
- **FORBID** writing stage reports / intel artifacts

### Class D — Doc-generation consumers (read-only intel)

`doc-intel`, `doc-researcher`, `doc-arch-writer`, `doc-catalog-writer`,
`doc-manual-writer`, `doc-test-runner`, `doc-testcase-writer`,
`doc-tkcs-writer`, `doc-exporter`, `tdoc-*` (Claude side)

- Render canonical intel → Office documents
- Output: `docs/generated/{slug}/output/*.{docx,xlsx}`
- **FORBID** any intel write — escalate `/intel-fill` / `/intel-refresh` nếu thiếu

## Skill matrix

| Skill | OS | Type | Stages cần |
|---|---|---|---|
| `/from-doc` | Claude | Producer | — (initial) |
| `/from-code` | Claude | Producer | — |
| `/new-feature` | Cursor | Producer | — (single feature) |
| `/resume-feature` | Cursor | Orchestrator | ba → sa → ... → reviewer |
| `/close-feature` | Cursor | Sealer | sau reviewer |
| `/generate-docs` | Claude | Consumer | sau close-feature |
| `/intel-refresh` | Claude | Updater | sau code change |
| `/intel-fill` | Claude | Wizard | T3 doc-only fields |

## Auto-extracted descriptions

Để xem mô tả đầy đủ của từng skill/agent:

```bash
ai-kit docs skills    # auto-list skills (frontmatter description)
ai-kit docs agents    # auto-list agents
```

## Liên quan

- LIFECYCLE.md full contract
- Workflows index
- Troubleshooting
