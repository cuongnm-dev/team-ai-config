// ID parsing + validation (port from Python sdlc/ids.py).
//
// Canonical formats: M-NNN, F-NNN[a-z]?, H-NNN. Slug: kebab-case ASCII.

const MODULE_ID_RE = /^M-(\d{3,})$/;
const FEATURE_ID_RE = /^F-(\d{3,})([a-z])?$/;
const HOTFIX_ID_RE = /^H-(\d{3,})$/;
const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export const IdKind = Object.freeze({
  MODULE: 'module',
  FEATURE: 'feature',
  HOTFIX: 'hotfix',
});

export const isValidModuleId  = (v) => MODULE_ID_RE.test(v);
export const isValidFeatureId = (v) => FEATURE_ID_RE.test(v);
export const isValidHotfixId  = (v) => HOTFIX_ID_RE.test(v);

export function isValidSlug(v) {
  return typeof v === 'string' && SLUG_RE.test(v) && !v.endsWith('-');
}

/**
 * Parse any ID; return {kind, num, sub}.
 * @throws Error if not a valid ID.
 */
export function parseId(value) {
  let m;
  if ((m = MODULE_ID_RE.exec(value))) return { kind: IdKind.MODULE, num: parseInt(m[1], 10), sub: null };
  if ((m = FEATURE_ID_RE.exec(value))) return { kind: IdKind.FEATURE, num: parseInt(m[1], 10), sub: m[2] || null };
  if ((m = HOTFIX_ID_RE.exec(value))) return { kind: IdKind.HOTFIX, num: parseInt(m[1], 10), sub: null };
  throw new Error(`Invalid ID: ${JSON.stringify(value)} (expected M-NNN, F-NNN, or H-NNN)`);
}

/** Compose canonical folder name: {ID}-{slug}. */
export const folderName = (entityId, slug) => `${entityId}-${slug}`;

/**
 * Split folder name back to {id, slug}.
 * @throws Error on invalid format.
 */
export function splitFolderName(folder) {
  const parts = folder.split('-');
  if (parts.length < 3) throw new Error(`Invalid folder name: ${JSON.stringify(folder)}`);
  return { id: `${parts[0]}-${parts[1]}`, slug: parts.slice(2).join('-') };
}

export { MODULE_ID_RE, FEATURE_ID_RE, HOTFIX_ID_RE, SLUG_RE };
