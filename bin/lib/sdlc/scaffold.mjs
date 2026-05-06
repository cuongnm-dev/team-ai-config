// Scaffold tools — atomic create operations (port from sdlc/scaffold.py).
//
// 5 functions: workspace, app_or_service, module, feature, hotfix.

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import { join, basename, resolve as pathResolve, isAbsolute, relative } from 'node:path';

import * as io from './intel-io.mjs';
import { FileTransaction, withWorkspaceLock } from './concurrency.mjs';
import {
  AlreadyExistsError, IdCollisionError, InvalidInputError, InvalidWorkspaceError,
  NotFoundError, NotMonoRepoError, successResponse,
} from './errors.mjs';
import { isValidFeatureId, isValidHotfixId, isValidModuleId, isValidSlug } from './ids.mjs';
import { MARKER_FILES, validateWorkspacePath } from './path-validation.mjs';
import { renderTemplate, utcIsoNow } from './templates.mjs';
import { assertVersion, bumpArtifact, readMeta, writeMeta } from './versioning.mjs';

const STAGES_QUEUE_S = ['tech-lead', 'dev-wave-1', 'reviewer'];
const STAGES_QUEUE_M = ['sa', 'tech-lead', 'dev-wave-1', 'qa-wave-1', 'reviewer'];
const STAGES_QUEUE_L = ['sa', 'security-design', 'tech-lead', 'dev-wave-1', 'qa-wave-1', 'security-review', 'reviewer'];

// ─── §3.1 scaffold_workspace ───

export async function scaffoldWorkspaceImpl(workspacePath, workspaceType, stack = 'none', config = null, force = false) {
  if (!['mini', 'mono'].includes(workspaceType)) {
    throw new InvalidInputError(`workspace_type must be 'mini' or 'mono', got ${JSON.stringify(workspaceType)}`,
      { details: { workspace_type: workspaceType } });
  }
  if (!isAbsolute(workspacePath)) {
    throw new InvalidWorkspaceError('workspace_path must be absolute',
      { details: { reason: 'not_absolute', value: workspacePath } });
  }

  // Create dir if missing (caller may pre-create or rely on us)
  await fs.mkdir(workspacePath, { recursive: true });
  const ws = pathResolve(workspacePath);

  const existingMarker = MARKER_FILES.find(m => existsSync(join(ws, m))) || null;
  const hasIntel = existsSync(join(ws, 'docs', 'intel', '_meta.json'));
  if ((existingMarker || hasIntel) && !force) {
    throw new AlreadyExistsError('Workspace already scaffolded', {
      details: { workspace_path: ws, marker_found: existingMarker, has_intel: hasIntel },
      fixHint: 'Pass force=true to re-scaffold, or use scaffold_module/feature for incremental.',
    });
  }

  const workspaceName = basename(ws);
  const createdAt = utcIsoNow();

  return await withWorkspaceLock(ws, async () => {
    const ctxIntel = { workspace_name: workspaceName, created_at: createdAt, multi_role: false };
    const metaContent = renderTemplate('intel/_meta.json', ctxIntel);
    const featCatContent = renderTemplate('intel/feature-catalog.json', ctxIntel);
    const modCatContent = renderTemplate('intel/module-catalog.json', ctxIntel);
    const modMapContent = renderTemplate('intel/module-map.yaml', ctxIntel);
    const featMapContent = renderTemplate('intel/feature-map.yaml', ctxIntel);
    const agentsMd = minimalAgentsMd(workspaceName, workspaceType, stack);
    const claudeMd = minimalClaudeMd(workspaceName);
    const gitignore = minimalGitignore(stack);
    const editorconfig = minimalEditorconfig();

    const tx = new FileTransaction();
    tx.add(join(io.intelDir(ws), '_meta.json'), metaContent);
    tx.add(io.featureCatalogPath(ws), featCatContent);
    tx.add(io.moduleCatalogPath(ws), modCatContent);
    tx.add(io.moduleMapPath(ws), modMapContent);
    tx.add(io.featureMapPath(ws), featMapContent);
    tx.add(join(ws, 'AGENTS.md'), agentsMd);
    tx.add(join(ws, 'CLAUDE.md'), claudeMd);
    tx.add(join(ws, '.gitignore'), gitignore);
    tx.add(join(ws, '.editorconfig'), editorconfig);

    for (const stub of [
      join(ws, 'docs', 'inputs', '.gitkeep'),
      join(ws, 'docs', 'generated', '.gitkeep'),
      join(ws, 'docs', 'architecture', 'adr', '.gitkeep'),
    ]) tx.add(stub, '');

    const finals = await tx.commit();

    const meta = await readMeta(ws);
    for (const [name, content] of [
      ['_meta.json', metaContent],
      ['feature-catalog.json', featCatContent],
      ['module-catalog.json', modCatContent],
      ['module-map.yaml', modMapContent],
      ['feature-map.yaml', featMapContent],
    ]) bumpArtifact(meta, name, { content, producer: 'ai-kit/scaffold_workspace' });
    await writeMeta(ws, meta);

    return successResponse({
      workspace_path: ws,
      workspace_type: workspaceType,
      stack,
      files_created: finals.map(p => relative(ws, p).replace(/\\/g, '/')),
      directories_created: ['docs/intel', 'docs/inputs', 'docs/generated', 'docs/architecture/adr'],
      intel_versions: {
        '_meta.json': 1,
        'feature-catalog.json': 1,
        'module-catalog.json': 1,
        'module-map.yaml': 1,
        'feature-map.yaml': 1,
      },
    });
  });
}

// ─── §3.3 scaffold_module ───

export async function scaffoldModuleImpl(workspacePath, moduleId, moduleName, slug, opts = {}) {
  const {
    modules_in_scope = [], depends_on = [], primary_service = '',
    agent_flags = {}, business_goal = '', output_mode = 'lean',
    risk_path = 'M', expected_catalog_version = null,
  } = opts;
  const ws = validateWorkspacePath(workspacePath);

  if (!isValidModuleId(moduleId)) throw new InvalidInputError(`Invalid module_id: ${JSON.stringify(moduleId)} (expected M-NNN)`, { details: { module_id: moduleId } });
  if (!isValidSlug(slug)) throw new InvalidInputError(`Invalid slug: ${JSON.stringify(slug)} (expected kebab-case ASCII)`, { details: { slug } });
  if ((moduleName || '').length < 3) throw new InvalidInputError('module_name too short (min 3 chars)', { details: { module_name: moduleName } });
  if (!['S', 'M', 'L'].includes(risk_path)) throw new InvalidInputError(`Invalid risk_path: ${JSON.stringify(risk_path)}`, { details: { risk_path } });

  return await withWorkspaceLock(ws, async () => {
    const catalog = await io.readModuleCatalog(ws);
    const mapData = await io.readModuleMap(ws);
    const meta = await readMeta(ws);

    assertVersion(meta, 'module-catalog.json', expected_catalog_version);

    const existing = io.allModuleIds(catalog, mapData);
    if (existing.has(moduleId)) {
      throw new IdCollisionError(`Module ID ${moduleId} already exists`, {
        details: { module_id: moduleId, existing: [...existing].sort() },
        fixHint: 'Choose next available M-NNN or use rename_module_slug.',
      });
    }
    for (const dep of depends_on) {
      if (!existing.has(dep)) {
        throw new NotFoundError(`Dependency module ${dep} not found`, { details: { missing: dep, module_id: moduleId } });
      }
    }

    const modPath = io.moduleDir(ws, moduleId, slug);
    const modPathRel = relative(ws, modPath).replace(/\\/g, '/');
    const stagesQueue = stagesQueueFor(risk_path, agent_flags);
    const createdAt = utcIsoNow();

    const ctx = {
      module_id: moduleId, module_name: moduleName, slug,
      modules_in_scope, depends_on, primary_service, agent_flags,
      business_goal, output_mode, repo_type: detectRepoType(ws),
      stages_queue: stagesQueue, created_at: createdAt,
      services: agent_flags.services || [],
    };
    const stateMd = renderTemplate('module/_state.md', ctx);
    const briefMd = renderTemplate('module/module-brief.md', ctx);
    const implYaml = renderTemplate('module/implementations.yaml', ctx);

    const newModule = {
      id: moduleId, name: moduleName, slug, status: 'in-progress',
      depends_on, feature_ids: [], primary_service,
      modules_in_scope, created_at: createdAt, agent_flags,
    };
    catalog.modules.push(newModule);
    if (!mapData.modules) mapData.modules = {};
    mapData.modules[moduleId] = { name: moduleName, slug, path: modPathRel };

    const catContent = io.serializeJson(catalog);
    const mapContent = io.serializeYaml(mapData);

    const tx = new FileTransaction();
    tx.add(join(modPath, '_state.md'), stateMd);
    tx.add(join(modPath, 'module-brief.md'), briefMd);
    tx.add(join(modPath, 'implementations.yaml'), implYaml);
    // Active stage folders match risk_path + agent_flags (Issue 2b fix 2026-05-07).
    // Path S → 4 folders (ba, tech-lead, dev, reviewer)
    // Path M → 6 folders (+ sa, qa)
    // Path L → 7 folders (+ security)
    // + designer if agent_flags.designer.screen_count > 0
    for (const sub of activeStageFoldersFor(risk_path, agent_flags)) {
      tx.add(join(modPath, sub, '.gitkeep'), '');
    }
    tx.add(io.moduleCatalogPath(ws), catContent);
    tx.add(io.moduleMapPath(ws), mapContent);
    const finals = await tx.commit();

    const newCatV = bumpArtifact(meta, 'module-catalog.json', { content: catContent, producer: 'ai-kit/scaffold_module' });
    const newMapV = bumpArtifact(meta, 'module-map.yaml', { content: mapContent, producer: 'ai-kit/scaffold_module' });
    await writeMeta(ws, meta);

    return successResponse({
      module_id: moduleId,
      module_path: modPathRel,
      files_created: finals.map(p => relative(ws, p).replace(/\\/g, '/')),
      intel_updated: ['docs/intel/module-catalog.json', 'docs/intel/module-map.yaml'],
      new_versions: { 'module-catalog.json': newCatV, 'module-map.yaml': newMapV },
      stages_queue: stagesQueue,
    });
  });
}

// ─── §3.4 scaffold_feature ───

export async function scaffoldFeatureImpl(workspacePath, moduleId, featureId, featureName, slug, opts = {}) {
  const {
    description = '', business_intent = '', flow_summary = '',
    acceptance_criteria = [], consumed_by_modules = [],
    priority = 'medium', expected_module_version = null,
  } = opts;
  const ws = validateWorkspacePath(workspacePath);

  if (!isValidModuleId(moduleId)) throw new InvalidInputError(`Invalid module_id: ${JSON.stringify(moduleId)}`, { details: { module_id: moduleId } });
  if (!isValidFeatureId(featureId)) throw new InvalidInputError(`Invalid feature_id: ${JSON.stringify(featureId)}`, { details: { feature_id: featureId } });
  if (!isValidSlug(slug)) throw new InvalidInputError(`Invalid slug: ${JSON.stringify(slug)}`, { details: { slug } });
  if (!['critical', 'high', 'medium', 'low'].includes(priority)) {
    throw new InvalidInputError(`Invalid priority: ${JSON.stringify(priority)}`, { details: { priority } });
  }

  return await withWorkspaceLock(ws, async () => {
    const modCat = await io.readModuleCatalog(ws);
    const featCat = await io.readFeatureCatalog(ws);
    const modMap = await io.readModuleMap(ws);
    const featMap = await io.readFeatureMap(ws);
    const meta = await readMeta(ws);

    assertVersion(meta, 'module-catalog.json', expected_module_version);

    const parent = io.findModule(modCat, moduleId);
    if (!parent) {
      throw new NotFoundError(`Parent module ${moduleId} not found`, {
        details: { module_id: moduleId, feature_id: featureId },
        fixHint: 'Run scaffold_module first.',
      });
    }
    const moduleSlug = parent.slug;

    const existingFeats = io.allFeatureIds(featCat, featMap);
    if (existingFeats.has(featureId)) {
      throw new IdCollisionError(`Feature ID ${featureId} already exists`, { details: { feature_id: featureId } });
    }

    const allModIds = io.allModuleIds(modCat, modMap);
    for (const cm of consumed_by_modules) {
      if (!allModIds.has(cm)) {
        throw new NotFoundError(`consumed_by module ${cm} not found`, { details: { missing: cm, feature_id: featureId } });
      }
    }

    const featPath = io.featureDir(ws, moduleId, moduleSlug, featureId, slug);
    const featPathRel = relative(ws, featPath).replace(/\\/g, '/');
    const createdAt = utcIsoNow();

    const ctx = {
      feature_id: featureId, feature_name: featureName, slug, module_id: moduleId,
      description, business_intent, flow_summary, acceptance_criteria,
      consumed_by_modules, priority, created_at: createdAt,
    };
    const featureMd = renderTemplate('feature/_feature.md', ctx);
    const implYaml = renderTemplate('feature/implementations.yaml', ctx);
    const evidenceJson = renderTemplate('feature/test-evidence.json', ctx);

    const newFeature = {
      id: featureId, module_id: moduleId, name: featureName, slug,
      status: 'proposed', priority, consumed_by_modules,
    };
    if (description) newFeature.description = description;
    if (business_intent) newFeature.business_intent = business_intent;
    if (flow_summary) newFeature.flow_summary = flow_summary;
    if (acceptance_criteria.length) newFeature.acceptance_criteria = acceptance_criteria;

    featCat.features.push(newFeature);
    if (!featMap.features) featMap.features = {};
    featMap.features[featureId] = {
      module: moduleId, name: featureName, slug, path: featPathRel, status: 'proposed',
    };
    if (!parent.feature_ids) parent.feature_ids = [];
    parent.feature_ids.push(featureId);

    const featCatContent = io.serializeJson(featCat);
    const featMapContent = io.serializeYaml(featMap);
    const modCatContent = io.serializeJson(modCat);

    const tx = new FileTransaction();
    tx.add(join(featPath, '_feature.md'), featureMd);
    tx.add(join(featPath, 'implementations.yaml'), implYaml);
    tx.add(join(featPath, 'test-evidence.json'), evidenceJson);
    for (const sub of ['dev', 'qa']) tx.add(join(featPath, sub, '.gitkeep'), '');
    tx.add(io.featureCatalogPath(ws), featCatContent);
    tx.add(io.featureMapPath(ws), featMapContent);
    tx.add(io.moduleCatalogPath(ws), modCatContent);
    const finals = await tx.commit();

    const newFCV = bumpArtifact(meta, 'feature-catalog.json', { content: featCatContent, producer: 'ai-kit/scaffold_feature' });
    const newFMV = bumpArtifact(meta, 'feature-map.yaml', { content: featMapContent, producer: 'ai-kit/scaffold_feature' });
    const newMCV = bumpArtifact(meta, 'module-catalog.json', { content: modCatContent, producer: 'ai-kit/scaffold_feature' });
    await writeMeta(ws, meta);

    return successResponse({
      feature_id: featureId,
      module_id: moduleId,
      feature_path: featPathRel,
      files_created: finals.map(p => relative(ws, p).replace(/\\/g, '/')),
      intel_updated: ['docs/intel/feature-catalog.json', 'docs/intel/feature-map.yaml', 'docs/intel/module-catalog.json'],
      new_versions: { 'feature-catalog.json': newFCV, 'feature-map.yaml': newFMV, 'module-catalog.json': newMCV },
    });
  });
}

// ─── §3.5 scaffold_hotfix ───

export async function scaffoldHotfixImpl(workspacePath, hotfixId, hotfixName, slug, patchSummary, opts = {}) {
  const { affected_modules = [], severity = 'high', severity_rationale = '' } = opts;
  const ws = validateWorkspacePath(workspacePath);

  if (!isValidHotfixId(hotfixId)) throw new InvalidInputError(`Invalid hotfix_id: ${JSON.stringify(hotfixId)}`, { details: { hotfix_id: hotfixId } });
  if (!isValidSlug(slug)) throw new InvalidInputError(`Invalid slug: ${JSON.stringify(slug)}`, { details: { slug } });
  if (!['critical', 'high', 'medium'].includes(severity)) throw new InvalidInputError(`Invalid severity: ${JSON.stringify(severity)}`, { details: { severity } });
  if ((patchSummary || '').length < 50) throw new InvalidInputError('patch_summary too short (min 50 chars)', { details: { length: (patchSummary || '').length } });

  return await withWorkspaceLock(ws, async () => {
    const modCat = await io.readModuleCatalog(ws);
    const modMap = await io.readModuleMap(ws);
    const allModIds = io.allModuleIds(modCat, modMap);
    const unknown = affected_modules.filter(m => !allModIds.has(m));

    const hfPath = io.hotfixDir(ws, hotfixId, slug);
    if (existsSync(hfPath)) {
      throw new IdCollisionError(`Hotfix folder already exists: ${relative(ws, hfPath).replace(/\\/g, '/')}`, {
        details: { hotfix_id: hotfixId, path: relative(ws, hfPath).replace(/\\/g, '/') },
      });
    }

    const ctx = {
      hotfix_id: hotfixId, hotfix_name: hotfixName, slug,
      patch_summary: patchSummary, affected_modules, severity, severity_rationale,
      repo_type: detectRepoType(ws), created_at: utcIsoNow(),
    };
    const stateMd = renderTemplate('hotfix/_state.md', ctx);
    const briefMd = renderTemplate('hotfix/patch-brief.md', ctx);
    const implYaml = renderTemplate('hotfix/implementations.yaml', ctx);

    const tx = new FileTransaction();
    tx.add(join(hfPath, '_state.md'), stateMd);
    tx.add(join(hfPath, 'patch-brief.md'), briefMd);
    tx.add(join(hfPath, 'implementations.yaml'), implYaml);
    for (const sub of ['tech-lead', 'dev', 'qa', 'reviewer']) tx.add(join(hfPath, sub, '.gitkeep'), '');
    const finals = await tx.commit();

    const warnings = [];
    if (unknown.length) {
      warnings.push({
        code: 'AFFECTED_MODULE_UNKNOWN',
        message: `affected_modules contains unknown IDs: ${unknown.join(', ')}`,
        ids: unknown,
      });
    }

    return successResponse({
      hotfix_id: hotfixId,
      hotfix_path: relative(ws, hfPath).replace(/\\/g, '/'),
      files_created: finals.map(p => relative(ws, p).replace(/\\/g, '/')),
      severity,
      affected_modules,
    }, warnings);
  });
}

// ─── §3.2 scaffold_app_or_service ───

export async function scaffoldAppOrServiceImpl(workspacePath, name, kind, stack = 'none', opts = {}) {
  const { expected_workspace_version: _ewv = null } = opts;
  const ws = validateWorkspacePath(workspacePath);

  if (!['app', 'service', 'lib', 'package'].includes(kind)) {
    throw new InvalidInputError(`Invalid kind: ${JSON.stringify(kind)} (expected app|service|lib|package)`, { details: { kind } });
  }
  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
    throw new InvalidInputError(`Invalid name: ${JSON.stringify(name)} (must be lowercase kebab-case, start with letter)`, { details: { name } });
  }
  if (!isMonoRepo(ws)) {
    throw new NotMonoRepoError('scaffold_app_or_service requires monorepo workspace', {
      details: { workspace_path: ws },
      fixHint: "Initialize workspace with workspace_type='mono' first.",
    });
  }

  const plural = { app: 'apps', service: 'services', lib: 'libs', package: 'packages' }[kind];
  const projectPath = join(ws, plural, name);
  if (existsSync(projectPath)) {
    throw new AlreadyExistsError(`${kind} ${JSON.stringify(name)} already exists`, {
      details: { path: relative(ws, projectPath).replace(/\\/g, '/') },
    });
  }

  return await withWorkspaceLock(ws, async () => {
    const tx = new FileTransaction();
    tx.add(join(projectPath, '.gitkeep'), '');
    tx.add(join(projectPath, 'src', '.gitkeep'), '');
    tx.add(join(projectPath, 'README.md'), `# ${name}\n\nKind: ${kind}\nStack: ${stack}\n`);
    const finals = await tx.commit();

    return successResponse({
      project_path: relative(ws, projectPath).replace(/\\/g, '/'),
      kind, name, stack,
      files_created: finals.map(p => relative(ws, p).replace(/\\/g, '/')),
      warnings: [{
        code: 'STACK_TEMPLATE_DEFERRED',
        message: `Stack template '${stack}' not bundled yet; populated minimal scaffold only.`,
      }],
    });
  });
}

// ─── helpers ───

function detectRepoType(ws) {
  return isMonoRepo(ws) ? 'mono' : 'mini';
}

function isMonoRepo(ws) {
  const hasTool = ['nx.json', 'turbo.json', 'pnpm-workspace.yaml', 'lerna.json'].some(f => existsSync(join(ws, f)));
  let hasDirs = false;
  for (const d of ['apps', 'services', 'libs', 'packages']) {
    if (existsSync(join(ws, d))) { hasDirs = true; break; }
  }
  return hasTool || hasDirs;
}

// Active stage subdirs per risk_path — matches stagesQueueFor + 'ba' (always — current-stage init).
// dev-wave-N → 'dev' folder; security-design / security-review → 'security' folder.
function activeStageFoldersFor(riskPath, agentFlags) {
  const folders = ['ba'];                                   // always — current-stage init
  if (riskPath === 'M' || riskPath === 'L') folders.push('sa');
  const designer = (agentFlags && agentFlags.designer) || {};
  if ((designer.screen_count || 0) > 0) {
    if (folders.includes('sa')) folders.splice(folders.indexOf('sa'), 0, 'designer');
    else folders.push('designer');
  }
  if (riskPath === 'L') folders.push('security');
  const security = (agentFlags && agentFlags.security) || {};
  if (security.pii_found && !folders.includes('security')) folders.push('security');
  folders.push('tech-lead', 'dev');
  if (riskPath === 'M' || riskPath === 'L') folders.push('qa');
  folders.push('reviewer');
  return folders;
}

function stagesQueueFor(riskPath, agentFlags) {
  const base = riskPath === 'S' ? [...STAGES_QUEUE_S]
             : riskPath === 'L' ? [...STAGES_QUEUE_L]
             : [...STAGES_QUEUE_M];
  const designer = agentFlags.designer || {};
  if (designer && (designer.screen_count || 0) > 0 && !base.includes('designer')) {
    const idx = base.indexOf('sa');
    if (idx >= 0) base.splice(idx, 0, 'designer'); else base.unshift('designer');
  }
  const security = agentFlags.security || {};
  if (security.pii_found && !base.includes('security-design')) {
    const idx = base.indexOf('tech-lead');
    if (idx >= 0) base.splice(idx, 0, 'security-design');
  }
  return base;
}

function minimalAgentsMd(workspaceName, workspaceType, stack) {
  return `# ${workspaceName}

workspace-type: ${workspaceType}
repo-type: ${workspaceType}
stack: ${stack}

## Convention

All SDLC scaffolding goes through \`ai-kit\` CLI (ADR-005).
Skills MUST NOT Write/mkdir under docs/{modules,features,hotfixes}/**.
`;
}

function minimalClaudeMd(workspaceName) {
  return `# ${workspaceName}

## Project context

(Populated during ba/sa stages.)
`;
}

function minimalGitignore(stack) {
  const base = '# OS\n.DS_Store\nThumbs.db\n\n# IDE\n.vscode/\n.idea/\n\n# Env\n.env\n.env.local\n\n';
  const stackRules = {
    nodejs: 'node_modules/\ndist/\n.next/\n*.log\n',
    python: '__pycache__/\n*.pyc\n.venv/\n.pytest_cache/\n.mypy_cache/\n',
    go: '*.exe\nvendor/\n',
    rust: 'target/\nCargo.lock\n',
  };
  return base + (stackRules[stack] || '');
}

function minimalEditorconfig() {
  return `root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
`;
}
