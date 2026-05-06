// resolve_path command (port from sdlc/resolve.py).
// Read-only; no lock acquired.

import { existsSync, statSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import YAML from 'yaml';

import { validateWorkspacePath } from './path-validation.mjs';
import { InvalidInputError, NotFoundError, successResponse } from './errors.mjs';
import * as io from './intel-io.mjs';

const VALID_KINDS = new Set(['module', 'feature', 'hotfix']);

/**
 * Resolve M-NNN/F-NNN/H-NNN to canonical filesystem path.
 * @param {string} workspacePath
 * @param {string} kind
 * @param {string} id
 * @param {boolean} [includeMetadata]
 */
export async function resolvePathImpl(workspacePath, kind, id, includeMetadata = false) {
  const ws = validateWorkspacePath(workspacePath);

  if (!VALID_KINDS.has(kind)) {
    throw new InvalidInputError(
      `Invalid kind: ${JSON.stringify(kind)} (expected one of ${[...VALID_KINDS].sort()})`,
      { details: { kind } }
    );
  }

  if (kind === 'module')  return resolveModule(ws, id, includeMetadata);
  if (kind === 'feature') return resolveFeature(ws, id, includeMetadata);
  return resolveHotfix(ws, id, includeMetadata);
}

async function resolveModule(ws, moduleId, includeMetadata) {
  const map = await io.readModuleMap(ws);
  let entry = (map.modules || {})[moduleId];
  let resolvedViaAlias = false;

  if (!entry) {
    const aliases = await io.readIdAliases(ws);
    for (const rename of (aliases.id_renames || [])) {
      if (rename.from === moduleId) {
        const canonical = rename.to;
        entry = (map.modules || {})[canonical];
        if (entry) {
          resolvedViaAlias = true;
          moduleId = canonical;
          break;
        }
      }
    }
  }

  if (!entry) {
    throw new NotFoundError(`Module ${JSON.stringify(moduleId)} not found in map or aliases`, {
      details: { module_id: moduleId, kind: 'module' },
      fixHint: 'Verify ID exists; check id-aliases.json for legacy renames.',
    });
  }

  const absPath = join(ws, entry.path);
  const data = {
    id: moduleId,
    kind: 'module',
    path: absPath.replace(/\\/g, '/'),
    relative_path: entry.path,
    exists: existsSync(absPath),
    resolved_via_alias: resolvedViaAlias,
  };

  if (includeMetadata) {
    const catalog = await io.readModuleCatalog(ws);
    const mod = io.findModule(catalog, moduleId);
    if (mod) {
      data.metadata = {
        name: mod.name,
        slug: mod.slug,
        status: mod.status,
        depends_on: mod.depends_on || [],
        feature_ids: mod.feature_ids || [],
        primary_service: mod.primary_service,
        created_at: mod.created_at,
      };
    }
  }
  return successResponse(data);
}

async function resolveFeature(ws, featureId, includeMetadata) {
  const map = await io.readFeatureMap(ws);
  let entry = (map.features || {})[featureId];
  let resolvedViaAlias = false;

  if (!entry) {
    const aliases = await io.readIdAliases(ws);
    for (const rename of (aliases.id_renames || [])) {
      if (rename.from === featureId) {
        const canonical = rename.to;
        entry = (map.features || {})[canonical];
        if (entry) {
          resolvedViaAlias = true;
          featureId = canonical;
          break;
        }
      }
    }
  }

  if (!entry) {
    throw new NotFoundError(`Feature ${JSON.stringify(featureId)} not found in map or aliases`, {
      details: { feature_id: featureId, kind: 'feature' },
    });
  }

  const absPath = join(ws, entry.path);
  const data = {
    id: featureId,
    kind: 'feature',
    path: absPath.replace(/\\/g, '/'),
    relative_path: entry.path,
    exists: existsSync(absPath),
    resolved_via_alias: resolvedViaAlias,
    module_id: entry.module,
  };

  if (includeMetadata) {
    const catalog = await io.readFeatureCatalog(ws);
    const feat = io.findFeature(catalog, featureId);
    if (feat) {
      data.metadata = {
        name: feat.name,
        slug: feat.slug,
        module_id: feat.module_id,
        consumed_by_modules: feat.consumed_by_modules || [],
        status: feat.status,
        priority: feat.priority,
      };
    }
  }
  return successResponse(data);
}

function resolveHotfix(ws, hotfixId, includeMetadata) {
  const hotfixesDir = join(ws, 'docs', 'hotfixes');
  if (!existsSync(hotfixesDir)) {
    throw new NotFoundError('No hotfixes directory in workspace', {
      details: { workspace_path: ws },
    });
  }
  for (const child of readdirSync(hotfixesDir)) {
    const childPath = join(hotfixesDir, child);
    if (!statSync(childPath).isDirectory()) continue;
    if (child.startsWith(`${hotfixId}-`)) {
      const data = {
        id: hotfixId,
        kind: 'hotfix',
        path: childPath.replace(/\\/g, '/'),
        relative_path: relative(ws, childPath).replace(/\\/g, '/'),
        exists: true,
        resolved_via_alias: false,
      };
      if (includeMetadata) {
        const stateFile = join(childPath, '_state.md');
        if (existsSync(stateFile)) {
          data.metadata = parseStateMdFrontmatter(stateFile);
        }
      }
      return successResponse(data);
    }
  }
  throw new NotFoundError(`Hotfix ${JSON.stringify(hotfixId)} not found`, {
    details: { hotfix_id: hotfixId, kind: 'hotfix' },
  });
}

function parseStateMdFrontmatter(path) {
  const text = readFileSync(path, 'utf-8');
  if (!text.startsWith('---')) return {};
  const parts = text.split('---', 3);
  if (parts.length < 3) return {};
  try { return YAML.parse(parts[1]) || {}; } catch { return {}; }
}
