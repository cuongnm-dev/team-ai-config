// Optimistic version control for intel artifacts (port from sdlc/versioning.py).

import { promises as fs, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';

import { atomicWriteText } from './concurrency.mjs';
import { VersionConflictError } from './errors.mjs';

/** Canonical _meta.json path. */
export const metaPath = (workspacePath) => join(workspacePath, 'docs', 'intel', '_meta.json');

/** Read _meta.json; return empty skeleton if absent. */
export async function readMeta(workspacePath) {
  const p = metaPath(workspacePath);
  if (!existsSync(p)) return emptyMeta();
  const text = await fs.readFile(p, 'utf-8');
  return JSON.parse(text);
}

export function getArtifactVersion(meta, artifactName) {
  const entry = (meta.artifacts || {})[artifactName] || {};
  return parseInt(entry.version || 0, 10);
}

/**
 * Assert expected_version matches stored.
 * @throws VersionConflictError on mismatch.
 */
export function assertVersion(meta, artifactName, expectedVersion) {
  const current = getArtifactVersion(meta, artifactName);
  if (expectedVersion != null && expectedVersion !== current) {
    throw new VersionConflictError(
      `Version conflict on ${artifactName}: expected ${expectedVersion}, current ${current}`,
      {
        details: { artifact: artifactName, expected: expectedVersion, current },
        fixHint: 'Re-read artifact, retry with current version.',
      }
    );
  }
  return current;
}

/**
 * Bump version + update hash + timestamp for artifact in meta dict.
 * Mutates meta in place. Returns new version.
 */
export function bumpArtifact(meta, artifactName, { content, producer = 'ai-kit/sdlc', timestamp = null } = {}) {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
  const sha = createHash('sha256').update(buf).digest('hex');
  if (!meta.artifacts) meta.artifacts = {};
  if (!meta.artifacts[artifactName]) meta.artifacts[artifactName] = {};
  const entry = meta.artifacts[artifactName];
  const newVersion = parseInt(entry.version || 0, 10) + 1;
  entry.version = newVersion;
  entry.content_hash = `sha256:${sha}`;
  entry.last_modified = timestamp || utcIsoNow();
  entry.last_producer = producer;
  return newVersion;
}

/** Atomic write _meta.json. */
export async function writeMeta(workspacePath, meta) {
  const p = metaPath(workspacePath);
  await fs.mkdir(dirname(p), { recursive: true });
  const content = JSON.stringify(meta, sortKeys, 2) + '\n';
  await atomicWriteText(p, content);
}

function emptyMeta() {
  return { schema_version: '1.0', default_reuse_mode: 'reuse_if_fresh', artifacts: {} };
}

/** Sort object keys deterministically (for stable JSON output). */
function sortKeys(_key, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value).sort().reduce((sorted, k) => {
      sorted[k] = value[k];
      return sorted;
    }, {});
  }
  return value;
}

export function utcIsoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function utcIsoNowFilename() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-');
}

export function utcIsoNowShort() {
  return new Date().toISOString().slice(0, 10);
}
