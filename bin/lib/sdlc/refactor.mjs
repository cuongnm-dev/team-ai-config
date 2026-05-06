// rename_module_slug command (port from sdlc/refactor.py).

import { promises as fs, existsSync } from 'node:fs';
import { relative, dirname, basename, join } from 'node:path';

import * as io from './intel-io.mjs';
import { FileTransaction, withWorkspaceLock } from './concurrency.mjs';
import { InvalidInputError, NameCollisionError, NotFoundError, successResponse } from './errors.mjs';
import { isValidModuleId, isValidSlug } from './ids.mjs';
import { validateWorkspacePath } from './path-validation.mjs';
import { utcIsoNow } from './templates.mjs';
import { bumpArtifact, readMeta, writeMeta } from './versioning.mjs';

export async function renameModuleSlugImpl(workspacePath, moduleId, newSlug, reason, opts = {}) {
  const { expected_version = null } = opts;
  const ws = validateWorkspacePath(workspacePath);

  if (!isValidModuleId(moduleId)) throw new InvalidInputError(`Invalid module_id: ${JSON.stringify(moduleId)}`, { details: { module_id: moduleId } });
  if (!isValidSlug(newSlug)) throw new InvalidInputError(`Invalid new_slug: ${JSON.stringify(newSlug)} (kebab-case ASCII required)`, { details: { new_slug: newSlug } });
  if (!reason || reason.length < 10) throw new InvalidInputError('reason required (min 10 chars) for audit trail', { details: { reason_length: (reason || '').length } });

  return await withWorkspaceLock(ws, async () => {
    const catalog = await io.readModuleCatalog(ws);
    const modMap  = await io.readModuleMap(ws);
    const featMap = await io.readFeatureMap(ws);
    const aliases = await io.readIdAliases(ws);
    const meta    = await readMeta(ws);

    const module = io.findModule(catalog, moduleId);
    if (!module) throw new NotFoundError(`Module ${moduleId} not found`, { details: { module_id: moduleId } });
    const oldSlug = module.slug;
    if (oldSlug === newSlug) {
      throw new InvalidInputError(`new_slug equals current slug: ${JSON.stringify(newSlug)} (no-op rename)`, { details: { current_slug: oldSlug } });
    }
    for (const other of (catalog.modules || [])) {
      if (other.id !== moduleId && other.slug === newSlug) {
        throw new NameCollisionError(`Slug ${JSON.stringify(newSlug)} already used by ${other.id}`, {
          details: { new_slug: newSlug, conflicts_with: other.id },
        });
      }
    }

    const oldFolder = io.moduleDir(ws, moduleId, oldSlug);
    const newFolder = io.moduleDir(ws, moduleId, newSlug);

    if (!existsSync(oldFolder)) {
      throw new NotFoundError(`Old module folder missing: ${relative(ws, oldFolder).replace(/\\/g, '/')}`, {
        details: { path: relative(ws, oldFolder).replace(/\\/g, '/') },
        fixHint: 'Folder may have been manually renamed or deleted; run autofix.',
      });
    }
    if (existsSync(newFolder)) {
      throw new NameCollisionError(`New folder path already occupied: ${relative(ws, newFolder).replace(/\\/g, '/')}`, {
        details: { path: relative(ws, newFolder).replace(/\\/g, '/') },
      });
    }

    // Step 1: rename folder atomically
    await fs.rename(oldFolder, newFolder);

    // Step 2: update catalog
    module.slug = newSlug;

    // Step 3: update module-map
    const newPathRel = relative(ws, newFolder).replace(/\\/g, '/');
    if (!modMap.modules) modMap.modules = {};
    if (modMap.modules[moduleId]) {
      modMap.modules[moduleId].slug = newSlug;
      modMap.modules[moduleId].path = newPathRel;
    }

    // Step 4: update feature-map paths under old folder
    const oldSeg = `docs/modules/${moduleId}-${oldSlug}/`;
    const newSeg = `docs/modules/${moduleId}-${newSlug}/`;
    let featMapUpdated = false;
    if (featMap.features) {
      for (const [_fid, entry] of Object.entries(featMap.features)) {
        if (entry.module === moduleId && (entry.path || '').startsWith(oldSeg)) {
          entry.path = entry.path.replace(oldSeg, newSeg);
          featMapUpdated = true;
        }
      }
    }

    // Step 5: append slug_rename entry
    if (!aliases.slug_renames) aliases.slug_renames = [];
    aliases.slug_renames.push({
      module_id: moduleId, old_slug: oldSlug, new_slug: newSlug,
      renamed_at: utcIsoNow(), reason,
    });

    const catalogContent = io.serializeJson(catalog);
    const modMapContent  = io.serializeYaml(modMap);
    const featMapContent = featMapUpdated ? io.serializeYaml(featMap) : null;
    const aliasesContent = io.serializeJson(aliases);

    const tx = new FileTransaction();
    tx.add(io.moduleCatalogPath(ws), catalogContent);
    tx.add(io.moduleMapPath(ws), modMapContent);
    if (featMapContent) tx.add(io.featureMapPath(ws), featMapContent);
    tx.add(io.idAliasesPath(ws), aliasesContent);
    const finals = await tx.commit();

    const newCatV = bumpArtifact(meta, 'module-catalog.json', { content: catalogContent, producer: 'ai-kit/rename_module_slug' });
    const newMapV = bumpArtifact(meta, 'module-map.yaml',     { content: modMapContent,  producer: 'ai-kit/rename_module_slug' });
    if (featMapContent) bumpArtifact(meta, 'feature-map.yaml', { content: featMapContent, producer: 'ai-kit/rename_module_slug' });
    bumpArtifact(meta, 'id-aliases.json', { content: aliasesContent, producer: 'ai-kit/rename_module_slug' });
    await writeMeta(ws, meta);

    return successResponse({
      module_id: moduleId, old_slug: oldSlug, new_slug: newSlug,
      old_path: relative(ws, oldFolder).replace(/\\/g, '/'),
      new_path: newPathRel, alias_added: true,
      references_updated: finals.map(p => relative(ws, p).replace(/\\/g, '/')),
      feature_map_updated: featMapUpdated,
      new_versions: { 'module-catalog.json': newCatV, 'module-map.yaml': newMapV },
    });
  });
}
