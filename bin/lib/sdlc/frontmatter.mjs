// YAML frontmatter parse/serialize (port from Python sdlc/frontmatter.py).
//
// Used by state mutations on _state.md / _feature.md. Preserves body verbatim.

import { promises as fs } from 'node:fs';
import YAML from 'yaml';

import { atomicWriteText } from './concurrency.mjs';

/** Parse Markdown text → [frontmatter, body]. */
export function parseFrontmatter(text) {
  if (!text.startsWith('---')) return [{}, text];
  const rest = text.startsWith('---\n') ? text.slice(4) : text.slice(3);
  let endIdx = rest.indexOf('\n---\n');
  if (endIdx === -1) endIdx = rest.indexOf('\n---\r\n');
  if (endIdx === -1) return [{}, text];
  const fmYaml = rest.slice(0, endIdx);
  const body = rest.slice(endIdx + 5);
  let fm;
  try { fm = YAML.parse(fmYaml) || {}; } catch { return [{}, text]; }
  if (typeof fm !== 'object' || Array.isArray(fm) || fm === null) return [{}, text];
  return [fm, body];
}

/** Read Markdown file → [frontmatter, body]. */
export async function readFrontmatter(path) {
  const text = await fs.readFile(path, 'utf-8');
  return parseFrontmatter(text);
}

/** Serialize [frontmatter, body] → text. */
export function serializeFrontmatter(frontmatter, body) {
  const fmYaml = YAML.stringify(frontmatter, {
    sortMapEntries: false,
    lineWidth: 0,
    defaultStringType: 'PLAIN',
  });
  let bodyOut = body;
  if (bodyOut && !bodyOut.startsWith('\n')) bodyOut = '\n' + bodyOut;
  return `---\n${fmYaml}---${bodyOut}`;
}

/** Atomic write Markdown file with frontmatter + body. */
export async function writeFrontmatter(path, frontmatter, body) {
  await atomicWriteText(path, serializeFrontmatter(frontmatter, body));
}

/**
 * Set data.a.b.c = value via dot-path. Returns [oldValue, newValue].
 * Creates intermediate dicts.
 */
export function setDotpath(data, dotpath, value) {
  const parts = dotpath.split('.');
  let target = data;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!target[p] || typeof target[p] !== 'object' || Array.isArray(target[p])) {
      target[p] = {};
    }
    target = target[p];
  }
  const last = parts[parts.length - 1];
  const old = target[last];
  target[last] = value;
  return [old, value];
}

/** Read data.a.b.c via dot-path; default if missing. */
export function getDotpath(data, dotpath, fallback = null) {
  const parts = dotpath.split('.');
  let target = data;
  for (const p of parts) {
    if (!target || typeof target !== 'object' || !(p in target)) return fallback;
    target = target[p];
  }
  return target;
}
