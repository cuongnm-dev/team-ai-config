// Scaffold template renderers (port from sdlc/templates.py + assets/scaffolds/*.j2).
//
// Templates are JS template literal functions instead of Jinja2 .j2 files —
// removes nunjucks/jinja2 dependency + asset bundling. Each function takes
// a context object and returns the rendered text. Output bytes-identical to
// Python ref impl when given equivalent context.

import { utcIsoNow } from './versioning.mjs';
import { TemplateNotFoundError } from './errors.mjs';

// ─── Jinja2-equivalent filter helpers ───

const tojson = (v) => JSON.stringify(v ?? null);
const dflt = (v, fallback) => (v === undefined || v === null || v === '' ? fallback : v);
const jl = (arr, sep) => (arr && arr.length) ? arr.join(sep) : '';

export { utcIsoNow };

// ─── intel/ ───

export function renderIntelMeta(ctx) {
  return `{
  "schema_version": "1.0",
  "workspace": ${tojson(ctx.workspace_name)},
  "created_at": "${ctx.created_at}",
  "updated_at": "${ctx.created_at}",
  "default_reuse_mode": "reuse_if_fresh",
  "patch_rounds": [],
  "artifacts": {}
}
`;
}

export function renderIntelFeatureCatalog(ctx) {
  return `{
  "schema_version": "1.0",
  "multi_role": ${tojson(ctx.multi_role ?? false)},
  "roles": [],
  "services": [],
  "features": []
}
`;
}

export function renderIntelFeatureMap(_ctx) {
  return `schema_version: "1.0"
features: {}
`;
}

export function renderIntelModuleCatalog(_ctx) {
  return `{
  "schema_version": "1.0",
  "modules": []
}
`;
}

export function renderIntelModuleMap(_ctx) {
  return `schema_version: "1.0"
modules: {}
`;
}

// ─── module/ ───

export function renderModuleStateMd(ctx) {
  const stagesQueueRows = (ctx.stages_queue || [])
    .map((stage, i) => `| ${i + 2} | ${stage} | ${stage} | — | — | — |`)
    .join('\n');
  return `---
feature-id: ${ctx.module_id}
feature-name: ${tojson(ctx.module_name)}
pipeline-type: sdlc
status: in-progress
depends-on: ${tojson(ctx.depends_on)}
blocked-by: []
created: "${ctx.created_at}"
last-updated: "${ctx.created_at}"
current-stage: ba
output-mode: ${dflt(ctx.output_mode, 'lean')}
repo-type: ${ctx.repo_type}
repo-path: "."
project: ${tojson(dflt(ctx.primary_service, ''))}
docs-path: docs/modules/${ctx.module_id}-${ctx.slug}
intel-path: docs/intel
stages-queue: ${tojson(ctx.stages_queue)}
completed-stages:
  doc-intel:
    verdict: "Ready for BA"
    completed-at: "${ctx.created_at}"
kpi:
  tokens-total: 0
  cycle-time-start: "${ctx.created_at}"
  tokens-by-stage: {}
rework-count: {}
locked-fields: []
agent-flags: ${tojson(dflt(ctx.agent_flags, {}))}
feature-req: |
  file:docs/modules/${ctx.module_id}-${ctx.slug}/module-brief.md
  canonical-fallback:docs/intel/_snapshot.md
  scope-modules: ${tojson(ctx.modules_in_scope)}
  scope-features: []
  dev-unit: ""
clarification-notes: ""
---

# Pipeline State: ${ctx.module_name}

## Business Goal

${dflt(ctx.business_goal, '[CẦN BỔ SUNG: 1-2 câu mô tả mục tiêu nghiệp vụ của module]')}

## Stage Progress

| # | Stage | Agent | Verdict | Artifact | Date |
|---|---|---|---|---|---|
| 1 | Intake | doc-intel | Ready for BA | docs/intel/_snapshot.md | ${ctx.created_at} |
${stagesQueueRows}

## Current Stage

**ba** — Ready to start. Input: \`docs/modules/${ctx.module_id}-${ctx.slug}/module-brief.md\`.

## Next Action

Cursor: \`/resume-module ${ctx.module_id}\` để dispatch BA agent.

## Active Blockers

none

## Wave Tracker

| Wave | Tasks | Dev Status | QA Status |
|---|---|---|---|

## Escalation Log

| Date | Item | Decision |
|---|---|---|
`;
}

export function renderModuleBriefMd(ctx) {
  return `---
module-id: ${ctx.module_id}
module-name: ${tojson(ctx.module_name)}
slug: ${ctx.slug}
canonical-source: docs/intel/_snapshot.md
generated-at: "${ctx.created_at}"
generator-version: "v1-mcp"
scope:
  modules: ${tojson(ctx.modules_in_scope)}
  features: []
  depends-on: ${tojson(ctx.depends_on)}
metrics:
  features-in-scope: 0
  primary-service: ${tojson(dflt(ctx.primary_service, ''))}
  total-entities-in-scope: 0
  total-rules-in-scope: 0
---

# Module Brief: ${ctx.module_name}

## Scope

| Dimension | Value |
|---|---|
| Module ID | ${ctx.module_id} |
| Slug | ${ctx.slug} |
| Primary service | \`${dflt(ctx.primary_service, '—')}\` |
| Depends-on | ${jl(ctx.depends_on, ', ') || 'none'} |
| Modules in scope | ${jl(ctx.modules_in_scope, ', ') || '—'} |

## Features in scope

(populated by \`scaffold_feature\` calls)

## Business Rules (scoped)

| ID | Rule | Type | Applies-to | Severity | Source |
|---|---|---|---|---|---|

## Entities + Relationships (scoped)

\`\`\`yaml
entities: []
relationships: []
state-machines: []
\`\`\`

## NFRs Applicable

| Area | Requirement | Target | Source |
|---|---|---|---|
| Performance | | | |
| Security | | | |
| Reliability | | | |
| Audit/Logging | | | |

## § Agent Hints (Opus-precomputed)

### § for ba

(populated during BA stage)

### § for sa

(populated during SA stage)

### § for tech-lead

(populated during tech-lead stage)

### § for dev

(populated during dev stages)

### § for qa

(populated during QA stage)

### § for reviewer — DoD checklist

(populated during reviewer stage)
`;
}

export function renderModuleImplementationsYaml(ctx) {
  return `module_id: ${ctx.module_id}
module_name: ${tojson(ctx.module_name)}
type: bounded-context
slug: ${ctx.slug}

# Map logical module → physical implementations across apps/services/libs.
# Updated by \`from-code\` Phase 5 (auto-detect) or \`dev\` agent (manual).
implementations:
  apps: ${tojson(dflt(ctx.apps, []))}
  services: ${tojson(dflt(ctx.services, []))}
  libs: ${tojson(dflt(ctx.libs, []))}
  packages: ${tojson(dflt(ctx.packages, []))}

# Stakeholder roster (BA fills business-owner; tech-lead fills tech-lead)
stakeholders:
  business-owner: ""
  tech-lead: ""
  qa-lead: ""

# Cross-references
depends_on: ${tojson(ctx.depends_on)}
`;
}

// ─── feature/ ───

export function renderFeatureMd(ctx) {
  const acItems = (ctx.acceptance_criteria && ctx.acceptance_criteria.length)
    ? ctx.acceptance_criteria.map(a => `- ${a}`).join('\n')
    : '- [CẦN BỔ SUNG: tiêu chí chấp nhận 1]\n- [CẦN BỔ SUNG: tiêu chí chấp nhận 2]\n- [CẦN BỔ SUNG: tiêu chí chấp nhận 3]';

  return `---
feature-id: ${ctx.feature_id}
feature-name: ${tojson(ctx.feature_name)}
slug: ${ctx.slug}
module-id: ${ctx.module_id}
status: proposed
priority: ${dflt(ctx.priority, 'medium')}
created: "${ctx.created_at}"
last-updated: "${ctx.created_at}"
locked-fields: []
consumed_by_modules: ${tojson(dflt(ctx.consumed_by_modules, []))}
---

# Feature: ${ctx.feature_name}

## Description

${dflt(ctx.description, '[CẦN BỔ SUNG: mô tả chi tiết tính năng, ≥ 200 ký tự]')}

## Business Intent

${dflt(ctx.business_intent, '[CẦN BỔ SUNG: mục đích kinh doanh, ≥ 100 ký tự]')}

## Flow Summary

${dflt(ctx.flow_summary, '[CẦN BỔ SUNG: tóm tắt luồng nghiệp vụ, ≥ 150 ký tự]')}

## Acceptance Criteria

${acItems}

## In Scope

(populated by ba stage)

## Out of Scope

(populated by ba stage)

## Roles + Permissions

| Role | Level | Notes |
|---|---|---|

## Entities

(populated by ba/sa stage)

## Business Rules

| ID | Rule | Applies-to | Source |
|---|---|---|---|

## Testing Strategy

(populated by qa stage)
`;
}

export function renderFeatureImplementationsYaml(ctx) {
  return `feature_id: ${ctx.feature_id}
module_id: ${ctx.module_id}
slug: ${ctx.slug}

# Map logical feature → physical code locations.
# Primary owner = service that implements feature's main flow.
# Consumers = services/apps that read or invoke this feature.
implementations:
  primary: ""
  consumers: []

# Cross-cutting: features consumed by multiple modules
consumed_by_modules: ${tojson(dflt(ctx.consumed_by_modules, []))}
`;
}

export function renderFeatureTestEvidenceJson(ctx) {
  return `{
  "schema_version": "1.0",
  "feature_id": "${ctx.feature_id}",
  "module_id": "${ctx.module_id}",
  "test_cases": [],
  "screenshots": [],
  "playwright_specs": [],
  "execution_history": []
}
`;
}

// ─── hotfix/ ───

export function renderHotfixStateMd(ctx) {
  return `---
feature-id: ${ctx.hotfix_id}
feature-name: ${tojson(ctx.hotfix_name)}
pipeline-type: hotfix
is-hotfix: true
status: in-progress
severity: ${dflt(ctx.severity, 'high')}
created: "${ctx.created_at}"
last-updated: "${ctx.created_at}"
current-stage: tech-lead
skipped-stages: [ba, sa, designer]
output-mode: lean
repo-type: ${ctx.repo_type}
repo-path: "."
docs-path: docs/hotfixes/${ctx.hotfix_id}-${ctx.slug}
intel-path: docs/intel
stages-queue: [tech-lead, dev-wave-1, qa-wave-1, reviewer]
affected-modules: ${tojson(dflt(ctx.affected_modules, []))}
locked-fields: []
kpi:
  tokens-total: 0
  cycle-time-start: "${ctx.created_at}"
  tokens-by-stage: {}
clarification-notes: ""
---

# Hotfix State: ${ctx.hotfix_name}

## Patch Summary

${ctx.patch_summary}

## Severity

**${dflt(ctx.severity, 'high')}** — ${dflt(ctx.severity_rationale, '[CẦN BỔ SUNG: lý do severity]')}

## Stage Progress

| # | Stage | Agent | Verdict | Artifact | Date |
|---|---|---|---|---|---|
| 1 | Intake | — | Skipped (hotfix) | — | ${ctx.created_at} |
| 2 | Tech-lead Plan | tech-lead | — | tech-lead/04-plan.md | — |
| 3 | Development | dev | — | dev/05-dev-w1-*.md | — |
| 4 | QA | qa | — | qa/07-qa-report.md | — |
| 5 | Review | reviewer | — | reviewer/08-review-report.md | — |

## Current Stage

**tech-lead** — Ready to start.

## Next Action

Cursor: \`/resume-feature ${ctx.hotfix_id}\` để dispatch tech-lead.

## Active Blockers

none

## Escalation Log

| Date | Item | Decision |
|---|---|---|
`;
}

export function renderHotfixBriefMd(ctx) {
  const affectedItems = (ctx.affected_modules && ctx.affected_modules.length)
    ? ctx.affected_modules.map(m => `- ${m}`).join('\n')
    : '[CẦN BỔ SUNG: danh sách module bị ảnh hưởng]';

  return `---
hotfix-id: ${ctx.hotfix_id}
hotfix-name: ${tojson(ctx.hotfix_name)}
slug: ${ctx.slug}
severity: ${ctx.severity}
affected-modules: ${tojson(ctx.affected_modules)}
created: "${ctx.created_at}"
---

# Hotfix Brief: ${ctx.hotfix_name}

## Patch Summary

${ctx.patch_summary}

## Affected Modules

${affectedItems}

## Severity Rationale

${dflt(ctx.severity_rationale, `[CẦN BỔ SUNG: lý do severity = ${ctx.severity}]`)}

## Root Cause

[CẦN BỔ SUNG: phân tích nguyên nhân gốc rễ]

## Fix Approach

[CẦN BỔ SUNG: hướng tiếp cận sửa lỗi]

## Rollback Plan

[CẦN BỔ SUNG: kế hoạch rollback nếu fix gây regression]
`;
}

export function renderHotfixImplementationsYaml(ctx) {
  return `hotfix_id: ${ctx.hotfix_id}
slug: ${ctx.slug}
affected_modules: ${tojson(ctx.affected_modules)}

# Files patched per affected module (populated by tech-lead/dev stages)
patches: []
`;
}

// ─── Registry: list templates per namespace ───

const TEMPLATE_INDEX = {
  intel: [
    '_meta.json',
    'feature-catalog.json',
    'feature-map.yaml',
    'module-catalog.json',
    'module-map.yaml',
  ],
  module: ['_state.md', 'module-brief.md', 'implementations.yaml'],
  feature: ['_feature.md', 'implementations.yaml', 'test-evidence.json'],
  hotfix: ['_state.md', 'patch-brief.md', 'implementations.yaml'],
};

const RENDERER_MAP = {
  'intel/_meta.json':            renderIntelMeta,
  'intel/feature-catalog.json':  renderIntelFeatureCatalog,
  'intel/feature-map.yaml':      renderIntelFeatureMap,
  'intel/module-catalog.json':   renderIntelModuleCatalog,
  'intel/module-map.yaml':       renderIntelModuleMap,
  'module/_state.md':            renderModuleStateMd,
  'module/module-brief.md':      renderModuleBriefMd,
  'module/implementations.yaml': renderModuleImplementationsYaml,
  'feature/_feature.md':         renderFeatureMd,
  'feature/implementations.yaml':renderFeatureImplementationsYaml,
  'feature/test-evidence.json':  renderFeatureTestEvidenceJson,
  'hotfix/_state.md':            renderHotfixStateMd,
  'hotfix/patch-brief.md':       renderHotfixBriefMd,
  'hotfix/implementations.yaml': renderHotfixImplementationsYaml,
};

/**
 * Render a template by `namespace/filename` key.
 * Mirrors `render_template(template_path, context)` from Python.
 * Note: kept legacy `.j2` suffix in caller-provided keys for compatibility,
 * stripped before lookup.
 */
export function renderTemplate(templatePath, context) {
  const key = templatePath.replace(/\.j2$/, '');
  const fn = RENDERER_MAP[key];
  if (!fn) {
    throw new TemplateNotFoundError(`Template not found: ${templatePath}`, {
      details: { template_path: templatePath, available: Object.keys(RENDERER_MAP) },
    });
  }
  return fn(context);
}

/**
 * List templates under namespace. Mirrors Python list_templates().
 * @param {string} namespace
 * @returns {Array<{id, type, size, last_updated}>}
 */
export function listTemplates(namespace) {
  const items = TEMPLATE_INDEX[namespace];
  if (!items) return [];
  // Synthesize metadata — size is rendered output size of empty context (best-effort).
  const stamp = utcIsoNow();
  return items.map(name => ({
    id: `${namespace}/${name}`,
    type: 'js-template-literal',
    size: -1, // size depends on context; reported -1 to indicate dynamic
    last_updated: stamp,
  }));
}
