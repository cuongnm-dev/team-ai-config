// Read/write helpers for intel artifacts (port from sdlc/intel_io.py).

import { promises as fs, existsSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';

import { atomicWriteText } from './concurrency.mjs';

// ─── Canonical paths within workspace ───

export const intelDir            = (ws) => join(ws, 'docs', 'intel');
export const featureCatalogPath  = (ws) => join(intelDir(ws), 'feature-catalog.json');
export const moduleCatalogPath   = (ws) => join(intelDir(ws), 'module-catalog.json');
export const moduleMapPath       = (ws) => join(intelDir(ws), 'module-map.yaml');
export const featureMapPath      = (ws) => join(intelDir(ws), 'feature-map.yaml');
export const idAliasesPath       = (ws) => join(intelDir(ws), 'id-aliases.json');

export const moduleDir   = (ws, mid, slug) => join(ws, 'docs', 'modules', `${mid}-${slug}`);
export const featureDir  = (ws, mid, mslug, fid, fslug) => join(moduleDir(ws, mid, mslug), 'features', `${fid}-${fslug}`);
export const hotfixDir   = (ws, hid, slug) => join(ws, 'docs', 'hotfixes', `${hid}-${slug}`);

// ─── Read helpers (return canonical empty if file missing) ───

export async function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  const text = await fs.readFile(path, 'utf-8');
  return JSON.parse(text);
}

export async function readYaml(path, fallback = null) {
  if (!existsSync(path)) return fallback;
  const text = await fs.readFile(path, 'utf-8');
  return YAML.parse(text) ?? fallback;
}

export const readModuleCatalog  = (ws) => readJson(moduleCatalogPath(ws),  { schema_version: '1.0', modules: [] });
export const readFeatureCatalog = (ws) => readJson(featureCatalogPath(ws), { schema_version: '1.0', multi_role: false, roles: [], services: [], features: [] });
export const readModuleMap      = (ws) => readYaml(moduleMapPath(ws),      { schema_version: '1.0', modules: {} });
export const readFeatureMap     = (ws) => readYaml(featureMapPath(ws),     { schema_version: '1.0', features: {} });
export const readIdAliases      = (ws) => readJson(idAliasesPath(ws),      { schema_version: '1.0', id_renames: [], slug_renames: [], reservations: [] });

// ─── Deterministic serialization ───

export function serializeJson(data, { sortKeys = true } = {}) {
  if (sortKeys) {
    return JSON.stringify(data, sortKeysReplacer, 2) + '\n';
  }
  return JSON.stringify(data, null, 2) + '\n';
}

function sortKeysReplacer(_k, v) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    return Object.keys(v).sort().reduce((acc, k) => { acc[k] = v[k]; return acc; }, {});
  }
  return v;
}

export function serializeYaml(data) {
  return YAML.stringify(data, { sortMapEntries: true, lineWidth: 0 });
}

export const writeJsonAtomic = (path, data) => atomicWriteText(path, serializeJson(data));
export const writeYamlAtomic = (path, data) => atomicWriteText(path, serializeYaml(data));

// ─── Lookup helpers ───

export function findModule(catalog, moduleId) {
  return (catalog.modules || []).find(m => m.id === moduleId) || null;
}

export function findFeature(catalog, featureId) {
  return (catalog.features || []).find(f => f.id === featureId) || null;
}

export function allModuleIds(catalog, mapData) {
  const ids = new Set();
  for (const m of (catalog.modules || [])) if (m.id) ids.add(m.id);
  for (const k of Object.keys(mapData.modules || {})) ids.add(k);
  return ids;
}

export function allFeatureIds(catalog, mapData) {
  const ids = new Set();
  for (const f of (catalog.features || [])) if (f.id) ids.add(f.id);
  for (const k of Object.keys(mapData.features || {})) ids.add(k);
  return ids;
}
