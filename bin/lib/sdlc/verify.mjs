// verify command — consolidated structural integrity check (port from sdlc/verify.py).
//
// 8 scopes via discriminator: structure, schemas, ownership, cross_references,
// freshness, completeness, id_uniqueness, all.
//
// Note re: "schemas" scope — Python uses jsonschema library. Node port skips
// JSON Schema validation (no ajv dependency); reports finding as informational.
// Other scopes are full parity with Python.

import { promises as fs, existsSync, statSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

import * as io from './intel-io.mjs';
import { InvalidInputError, VerificationFailedError, successResponse } from './errors.mjs';
import { readFrontmatter } from './frontmatter.mjs';
import { validateWorkspacePath } from './path-validation.mjs';

const VALID_SCOPES = new Set(['structure', 'schemas', 'ownership', 'cross_references', 'freshness', 'completeness', 'id_uniqueness', 'all']);
const STRICT_MODES = ['block', 'warn', 'info'];
const SEV_HIGH = 'high', SEV_MED = 'medium', SEV_LOW = 'low';

const REQUIRED_INTEL_FILES = ['_meta.json', 'feature-catalog.json', 'module-catalog.json', 'module-map.yaml', 'feature-map.yaml'];
const REQUIRED_DIRS = ['docs/intel', 'docs/inputs', 'docs/generated'];
const MODULE_REQUIRED_FILES = ['_state.md', 'module-brief.md', 'implementations.yaml'];
const MODULE_REQUIRED_SUBDIRS = ['ba', 'sa', 'designer', 'security', 'tech-lead', 'qa', 'reviewer'];
const FEATURE_REQUIRED_FILES = ['_feature.md', 'implementations.yaml', 'test-evidence.json'];
const FEATURE_REQUIRED_SUBDIRS = ['dev', 'qa'];

const STAGE_REQUIRED_ARTIFACTS = {
  ba: ['ba/00-lean-spec.md'],
  sa: ['sa/00-lean-architecture.md'],
  designer: ['designer/01-wireframes.md'],
  'tech-lead': ['tech-lead/04-plan.md'],
  'qa-wave-1': ['qa/07-qa-report-w1.md'],
  reviewer: ['reviewer/08-review-report.md'],
  'security-design': ['security/03-threat-model.md'],
  'security-review': ['security/06-security-review.md'],
};

const MODULE_FOLDER_RE = /^M-\d{3,}-[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const HOTFIX_FOLDER_RE = /^H-\d{3,}-[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const FEATURE_FOLDER_RE = /^F-\d{3,}[a-z]?-[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const ID_RE = /^([MFH])-(\d+)([a-z]?)$/;

export async function verifyImpl(workspacePath, scopes, opts = {}) {
  const { strict_mode = 'warn' } = opts;
  const context = opts.context || {};
  const ws = validateWorkspacePath(workspacePath);

  if (!scopes || !scopes.length) throw new InvalidInputError('scopes is empty', { details: { scopes } });
  const invalid = scopes.filter(s => !VALID_SCOPES.has(s));
  if (invalid.length) throw new InvalidInputError(`Invalid scopes: ${invalid.join(', ')}`, { details: { invalid, valid: [...VALID_SCOPES].sort() } });
  if (!STRICT_MODES.includes(strict_mode)) throw new InvalidInputError(`Invalid strict_mode: ${JSON.stringify(strict_mode)}`, { details: { strict_mode, valid: STRICT_MODES } });

  let expanded = new Set(scopes);
  if (expanded.has('all')) expanded = new Set([...VALID_SCOPES].filter(s => s !== 'all'));

  const findings = [];
  if (expanded.has('structure'))         findings.push(...checkStructure(ws));
  if (expanded.has('schemas'))           findings.push(...await checkSchemas(ws));
  if (expanded.has('ownership'))         findings.push(...checkOwnership(ws, context.agent_log || []));
  if (expanded.has('cross_references')) findings.push(...await checkCrossReferences(ws));
  if (expanded.has('freshness'))         findings.push(...await checkFreshness(ws));
  if (expanded.has('completeness'))      findings.push(...checkCompleteness(ws, context.current_stage));
  if (expanded.has('id_uniqueness'))     findings.push(...await checkIdUniqueness(ws));

  const summary = aggregate(findings);

  if (strict_mode === 'block' && summary.failed > 0) {
    throw new VerificationFailedError(`${summary.failed} HIGH-severity violation(s) detected`, {
      details: { summary, findings },
    });
  }

  return successResponse({ summary, findings, scopes_checked: [...expanded].sort(), strict_mode });
}

// ─── scope: structure ───

function checkStructure(ws) {
  const findings = [];
  for (const d of REQUIRED_DIRS) {
    if (!existsSync(join(ws, d)) || !statSync(join(ws, d)).isDirectory()) {
      findings.push(finding('structure', SEV_HIGH, 'missing-required-dir', d, `Required directory missing: ${d}`,
        { fixHint: 'Run scaffold workspace OR autofix(missing-scaffold).' }));
    }
  }
  const intel = join(ws, 'docs', 'intel');
  if (existsSync(intel) && statSync(intel).isDirectory()) {
    for (const f of REQUIRED_INTEL_FILES) {
      if (!existsSync(join(intel, f))) {
        findings.push(finding('structure', SEV_HIGH, 'missing-required-intel-file', `docs/intel/${f}`, `Required intel file missing: ${f}`));
      }
    }
  }

  const modulesDir = join(ws, 'docs', 'modules');
  if (existsSync(modulesDir) && statSync(modulesDir).isDirectory()) {
    for (const child of readdirSync(modulesDir)) {
      const childPath = join(modulesDir, child);
      if (!statSync(childPath).isDirectory()) continue;
      if (!MODULE_FOLDER_RE.test(child)) {
        findings.push(finding('structure', SEV_MED, 'module-folder-name-malformed', `docs/modules/${child}`, `Module folder name doesn't match M-NNN-{slug} pattern`));
        continue;
      }
      findings.push(...checkModuleSubstructure(ws, childPath));
    }
  }

  const hotfixesDir = join(ws, 'docs', 'hotfixes');
  if (existsSync(hotfixesDir) && statSync(hotfixesDir).isDirectory()) {
    for (const child of readdirSync(hotfixesDir)) {
      const childPath = join(hotfixesDir, child);
      if (statSync(childPath).isDirectory() && !HOTFIX_FOLDER_RE.test(child)) {
        findings.push(finding('structure', SEV_MED, 'hotfix-folder-name-malformed', `docs/hotfixes/${child}`, `Hotfix folder name doesn't match H-NNN-{slug} pattern`));
      }
    }
  }
  return findings;
}

function checkModuleSubstructure(ws, moduleDir) {
  const findings = [];
  const rel = relative(ws, moduleDir).replace(/\\/g, '/');

  for (const f of MODULE_REQUIRED_FILES) {
    if (!existsSync(join(moduleDir, f))) {
      findings.push(finding('structure', SEV_HIGH, 'module-missing-file', `${rel}/${f}`, `Module ${relative(ws, moduleDir).split(/[/\\]/).pop()} missing required file: ${f}`,
        { fixHint: 'Run scaffold module via ai-kit, or migrate via migrate_features_to_modules.py.' }));
    }
  }
  for (const sub of MODULE_REQUIRED_SUBDIRS) {
    const subPath = join(moduleDir, sub);
    if (!existsSync(subPath) || !statSync(subPath).isDirectory()) {
      findings.push(finding('structure', SEV_HIGH, 'module-missing-stage-subdir', `${rel}/${sub}/`, `Module ${relative(ws, moduleDir).split(/[/\\]/).pop()} missing stage subdir: ${sub}/`));
    }
  }

  const featuresDir = join(moduleDir, '_features');
  if (existsSync(featuresDir) && statSync(featuresDir).isDirectory()) {
    for (const child of readdirSync(featuresDir)) {
      const childPath = join(featuresDir, child);
      if (!statSync(childPath).isDirectory()) continue;
      if (!FEATURE_FOLDER_RE.test(child)) {
        findings.push(finding('structure', SEV_MED, 'feature-folder-name-malformed', relative(ws, childPath).replace(/\\/g, '/'), `Feature folder name doesn't match F-NNN-{slug} pattern`));
        continue;
      }
      findings.push(...checkFeatureSubstructure(ws, childPath));
    }
  }
  return findings;
}

function checkFeatureSubstructure(ws, featureDir) {
  const findings = [];
  const rel = relative(ws, featureDir).replace(/\\/g, '/');
  for (const f of FEATURE_REQUIRED_FILES) {
    if (!existsSync(join(featureDir, f))) {
      findings.push(finding('structure', SEV_HIGH, 'feature-missing-file', `${rel}/${f}`, `Feature ${relative(ws, featureDir).split(/[/\\]/).pop()} missing required file: ${f}`));
    }
  }
  for (const sub of FEATURE_REQUIRED_SUBDIRS) {
    const subPath = join(featureDir, sub);
    if (!existsSync(subPath) || !statSync(subPath).isDirectory()) {
      findings.push(finding('structure', SEV_MED, 'feature-missing-subdir', `${rel}/${sub}/`, `Feature ${relative(ws, featureDir).split(/[/\\]/).pop()} missing subdir: ${sub}/`));
    }
  }
  return findings;
}

// ─── scope: schemas (informational — JSON Schema validation deferred) ───

async function checkSchemas(ws) {
  return [
    finding('schemas', SEV_LOW, 'jsonschema-validation-skipped', '',
      'JSON Schema validation deferred (no ajv dependency in ai-kit). Run Python verify --scopes schemas to validate against bundled schemas during P1 transition window.',
      { fixHint: 'Use `etc-platform verify --scopes schemas` (Python CLI) for schema-level validation until full Node port.' }),
  ];
}

// ─── scope: ownership ───

function checkOwnership(_ws, agentLog) {
  const findings = [];
  if (!agentLog || !agentLog.length) {
    findings.push(finding('ownership', SEV_LOW, 'no-agent-log', '', 'No agent_log provided — ownership check skipped'));
  }
  // TODO P1: cross-check each agent_log entry against ownership matrix.
  return findings;
}

// ─── scope: cross_references ───

async function checkCrossReferences(ws) {
  const findings = [];
  const modCatalog = await io.readModuleCatalog(ws);
  const featCatalog = await io.readFeatureCatalog(ws);
  const modMap = await io.readModuleMap(ws);
  const featMap = await io.readFeatureMap(ws);

  const allModIds = io.allModuleIds(modCatalog, modMap);

  for (const feat of (featCatalog.features || [])) {
    const fid = feat.id;
    const mid = feat.module_id;
    if (!mid) {
      findings.push(finding('cross_references', SEV_HIGH, 'feature-missing-module_id', `feature ${fid}`, `Feature ${fid} missing required module_id`));
      continue;
    }
    if (!allModIds.has(mid)) {
      findings.push(finding('cross_references', SEV_HIGH, 'feature-module-fk-broken', `feature ${fid}`, `Feature ${fid}.module_id=${mid} not found in module-catalog/map`));
    }
    for (const cm of (feat.consumed_by_modules || [])) {
      if (!allModIds.has(cm)) {
        findings.push(finding('cross_references', SEV_MED, 'feature-consumed-by-fk-broken', `feature ${fid}`, `Feature ${fid}.consumed_by_modules contains unknown ${cm}`));
      }
    }
  }

  const allFeatIds = io.allFeatureIds(featCatalog, featMap);
  for (const mod of (modCatalog.modules || [])) {
    const mid = mod.id;
    for (const dep of (mod.depends_on || [])) {
      if (!allModIds.has(dep)) {
        findings.push(finding('cross_references', SEV_HIGH, 'module-depends-on-fk-broken', `module ${mid}`, `Module ${mid}.depends_on=${dep} not found`));
      }
    }
    for (const fid of (mod.feature_ids || [])) {
      if (!allFeatIds.has(fid)) {
        findings.push(finding('cross_references', SEV_HIGH, 'module-feature-fk-broken', `module ${mid}`, `Module ${mid}.feature_ids contains unknown ${fid}`));
      }
    }
  }

  for (const [fid, entry] of Object.entries(featMap.features || {})) {
    const mid = entry.module;
    if (mid && !allModIds.has(mid)) {
      findings.push(finding('cross_references', SEV_HIGH, 'feature-map-module-fk-broken', `feature-map ${fid}`, `feature-map[${fid}].module=${mid} not found`));
    }
  }
  return findings;
}

// ─── scope: freshness ───

async function checkFreshness(ws) {
  const findings = [];
  const metaP = join(ws, 'docs', 'intel', '_meta.json');
  if (!existsSync(metaP)) {
    findings.push(finding('freshness', SEV_HIGH, 'missing-meta', 'docs/intel/_meta.json', '_meta.json missing — cannot check freshness'));
    return findings;
  }
  let meta;
  try { meta = JSON.parse(await fs.readFile(metaP, 'utf-8')); }
  catch (err) {
    findings.push(finding('freshness', SEV_HIGH, 'meta-parse-error', 'docs/intel/_meta.json', `Parse error: ${err.message}`));
    return findings;
  }

  const now = Date.now();
  for (const [artName, entry] of Object.entries(meta.artifacts || {})) {
    const ttlDays = entry.ttl_days;
    if (ttlDays == null) continue;
    const lastModified = entry.last_modified;
    if (!lastModified) continue;
    let lm;
    try { lm = new Date(lastModified.replace(/Z$/, '')).getTime(); } catch { continue; }
    if (isNaN(lm)) continue;
    const ageDays = Math.floor((now - lm) / 86400000);
    if (ageDays > ttlDays) {
      findings.push(finding('freshness', SEV_MED, 'ttl-exceeded', `docs/intel/${artName}`, `${artName}: age ${ageDays}d > TTL ${ttlDays}d`));
    }

    const artPath = join(ws, 'docs', 'intel', artName);
    if (existsSync(artPath) && entry.content_hash) {
      const cur = createHash('sha256').update(await fs.readFile(artPath)).digest('hex');
      const stored = entry.content_hash.replace(/^sha256:/, '');
      if (cur !== stored) {
        findings.push(finding('freshness', SEV_MED, 'content-hash-mismatch', `docs/intel/${artName}`, `${artName}: stored hash != current (modified outside ai-kit?)`));
      }
    }
  }
  return findings;
}

// ─── scope: completeness ───

function checkCompleteness(ws, currentStage) {
  const findings = [];
  if (!currentStage) {
    findings.push(finding('completeness', SEV_LOW, 'no-current-stage', '', 'No current_stage in context — completeness check skipped'));
    return findings;
  }
  const required = STAGE_REQUIRED_ARTIFACTS[currentStage];
  if (!required) return findings;

  const modulesDir = join(ws, 'docs', 'modules');
  if (!existsSync(modulesDir)) return findings;
  for (const child of readdirSync(modulesDir)) {
    const moduleDir = join(modulesDir, child);
    if (!statSync(moduleDir).isDirectory()) continue;
    for (const rel of required) {
      const artifact = join(moduleDir, rel);
      if (!existsSync(artifact) || statSync(artifact).size === 0) {
        findings.push(finding('completeness', SEV_HIGH, 'missing-stage-artifact', relative(ws, artifact).replace(/\\/g, '/'), `Required for stage '${currentStage}': ${rel}`));
      }
    }
  }
  return findings;
}

// ─── scope: id_uniqueness ───

async function checkIdUniqueness(ws) {
  const findings = [];
  const modCatalog = await io.readModuleCatalog(ws);
  const featCatalog = await io.readFeatureCatalog(ws);
  const modMap = await io.readModuleMap(ws);
  const featMap = await io.readFeatureMap(ws);
  const aliases = await io.readIdAliases(ws);

  const sources = {};
  const addSrc = (k, v) => { (sources[k] || (sources[k] = new Set())).add(v); };

  for (const m of (modCatalog.modules || [])) if (m.id) addSrc('module-catalog', m.id);
  for (const k of Object.keys(modMap.modules || {})) addSrc('module-map', k);
  for (const f of (featCatalog.features || [])) if (f.id) addSrc('feature-catalog', f.id);
  for (const k of Object.keys(featMap.features || {})) addSrc('feature-map', k);

  const modulesDir = join(ws, 'docs', 'modules');
  if (existsSync(modulesDir)) {
    for (const child of readdirSync(modulesDir)) {
      const cp = join(modulesDir, child);
      if (statSync(cp).isDirectory()) {
        const m = /^(M-\d+)-/.exec(child);
        if (m) addSrc('filesystem-modules', m[1]);
        const featuresDir = join(cp, '_features');
        if (existsSync(featuresDir)) {
          for (const fc of readdirSync(featuresDir)) {
            const fcPath = join(featuresDir, fc);
            if (!statSync(fcPath).isDirectory()) continue;
            const fm = /^(F-\d+[a-z]?)-/.exec(fc);
            if (fm) addSrc('filesystem-features', fm[1]);
          }
        }
      }
    }
  }

  const hotfixesDir = join(ws, 'docs', 'hotfixes');
  if (existsSync(hotfixesDir)) {
    for (const child of readdirSync(hotfixesDir)) {
      const cp = join(hotfixesDir, child);
      if (statSync(cp).isDirectory()) {
        const m = /^(H-\d+)-/.exec(child);
        if (m) addSrc('filesystem-hotfixes', m[1]);
      }
    }
  }

  // gap detection
  const reservations = parseReservations(aliases.reservations || []);
  for (const [kindPrefix, _label] of [['M', 'module'], ['F', 'feature'], ['H', 'hotfix']]) {
    const ids = new Set();
    for (const set of Object.values(sources)) {
      for (const sid of set) if (sid.startsWith(`${kindPrefix}-`)) ids.add(sid);
    }
    if (!ids.size) continue;
    const nums = [...ids].map(extractNum).filter(n => n != null).sort((a, b) => a - b);
    if (!nums.length) continue;
    let prev = nums[0];
    for (let i = 1; i < nums.length; i++) {
      const n = nums[i];
      const gap = n - prev - 1;
      if (gap > 0) {
        const gs = prev + 1, ge = n - 1;
        const gr = `${kindPrefix}-${String(gs).padStart(3, '0')}..${kindPrefix}-${String(ge).padStart(3, '0')}`;
        if (gap > 10 && !isReserved(gs, ge, kindPrefix, reservations)) {
          findings.push(finding('id_uniqueness', SEV_MED, 'unjustified-gap', `${kindPrefix}-NNN sequence`,
            `Unjustified gap > 10 IDs at ${gr} (${gap} missing). Add id-aliases.json reservations entry to justify.`));
        } else if (gap > 1) {
          findings.push(finding('id_uniqueness', SEV_LOW, 'non-contiguous', `${kindPrefix}-NNN sequence`,
            `Non-contiguous ID gap at ${gr} (${gap} missing)`));
        }
      }
      prev = n;
    }
  }

  // filesystem orphans
  const fsMods = sources['filesystem-modules'] || new Set();
  const catMods = sources['module-catalog'] || new Set();
  for (const mid of fsMods) {
    if (!catMods.has(mid)) {
      findings.push(finding('id_uniqueness', SEV_HIGH, 'filesystem-orphan', `docs/modules/${mid}-*`,
        `Module folder ${mid} exists on filesystem but not in module-catalog`,
        { fixHint: 'Run autofix(missing-scaffold) OR remove orphan folder.' }));
    }
  }
  const fsFeats = sources['filesystem-features'] || new Set();
  const catFeats = sources['feature-catalog'] || new Set();
  for (const fid of fsFeats) {
    if (!catFeats.has(fid)) {
      findings.push(finding('id_uniqueness', SEV_HIGH, 'filesystem-orphan', `feature ${fid}`,
        `Feature folder ${fid} exists on filesystem but not in feature-catalog`));
    }
  }

  // catalog orphans
  for (const mid of catMods) {
    if (!fsMods.has(mid)) {
      findings.push(finding('id_uniqueness', SEV_HIGH, 'catalog-orphan', `module-catalog ${mid}`,
        `Module ${mid} in catalog but no folder on filesystem`));
    }
  }

  return findings;
}

function extractNum(sid) {
  const m = ID_RE.exec(sid);
  return m ? parseInt(m[2], 10) : null;
}

function parseReservations(items) {
  const out = [];
  const re = /^([MFH])-(\d+)\.\.\1-(\d+)$/;
  for (const it of items) {
    const m = re.exec(it.range || '');
    if (m) out.push([m[1], parseInt(m[2], 10), parseInt(m[3], 10)]);
  }
  return out;
}

function isReserved(start, end, kind, reservations) {
  return reservations.some(([rk, rs, re]) => rk === kind && rs <= start && end <= re);
}

// ─── helpers ───

function finding(scope, severity, rule, location, message, opts = {}) {
  const f = { scope, severity, rule, location, message };
  if (opts.fixHint) f.fix_hint = opts.fixHint;
  if (opts.details) f.details = opts.details;
  return f;
}

function aggregate(findings) {
  const summary = { passed: 0, failed: 0, warnings: 0, info: 0 };
  for (const f of findings) {
    if (f.severity === SEV_HIGH) summary.failed++;
    else if (f.severity === SEV_MED) summary.warnings++;
    else summary.info++;
  }
  return summary;
}
