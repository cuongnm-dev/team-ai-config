// Workspace path validation (port from Python sdlc/path_validation.py).
//
// All SDLC commands accepting workspace_path validate it server-side to
// prevent accidental writes outside controlled tree. Native Node — no
// Linux container assumption (path is interpreted on the host machine).
//
// Mandatory checks:
//   1. Absolute path (Windows D:\... OR POSIX /...)
//   2. Resolves to existing directory
//   3. Contains marker file (.git/AGENTS.md/CLAUDE.md/package.json/pyproject.toml/go.mod)
//   4. No unexpanded environment variables (~, $, ${VAR})

import { resolve, isAbsolute, join, relative } from 'node:path';
import { existsSync, statSync } from 'node:fs';

import { InvalidWorkspaceError } from './errors.mjs';

const MARKER_FILES = ['.git', 'AGENTS.md', 'CLAUDE.md', 'package.json', 'pyproject.toml', 'go.mod'];
const ALLOWED_WRITE_PREFIXES = ['docs', 'apps', 'services', 'libs', 'packages', 'tools'];

/**
 * Validate workspace_path; return resolved absolute path string.
 * @param {string} workspacePath
 * @returns {string} resolved absolute POSIX-style path (forward slashes preserved on input).
 */
export function validateWorkspacePath(workspacePath) {
  if (!workspacePath) {
    throw new InvalidWorkspaceError('workspace_path is empty', { details: { reason: 'empty' } });
  }
  const raw = String(workspacePath);
  if (raw.includes('~') || raw.includes('$')) {
    throw new InvalidWorkspaceError('workspace_path contains unexpanded shell variables', {
      details: { reason: 'env_var_unexpanded', value: raw },
      fixHint: 'Caller must expand ~ and $VAR before calling.',
    });
  }
  if (!isAbsolute(raw)) {
    throw new InvalidWorkspaceError('workspace_path must be absolute', {
      details: { reason: 'not_absolute', value: raw },
      fixHint: 'Pass absolute path (e.g. C:/Users/.../project or /home/user/project).',
    });
  }
  let resolved;
  try {
    resolved = resolve(raw);
  } catch (err) {
    throw new InvalidWorkspaceError(`workspace_path resolution failed: ${err.message}`, {
      details: { reason: 'resolve_failed', value: raw },
    });
  }
  if (!existsSync(resolved)) {
    throw new InvalidWorkspaceError('workspace_path does not exist', {
      details: { reason: 'not_exists', value: raw, resolved },
    });
  }
  if (!statSync(resolved).isDirectory()) {
    throw new InvalidWorkspaceError('workspace_path is not a directory', {
      details: { reason: 'not_directory', value: resolved },
    });
  }
  if (!hasMarker(resolved)) {
    throw new InvalidWorkspaceError('workspace_path missing marker file', {
      details: { reason: 'no_marker', value: resolved, expected_one_of: MARKER_FILES },
      fixHint: `Workspace must contain at least one marker file: ${MARKER_FILES.join(', ')}. Run scaffold workspace first OR verify path is correct project root.`,
    });
  }
  return resolved;
}

function hasMarker(absPath) {
  return MARKER_FILES.some(m => existsSync(join(absPath, m)));
}

/**
 * Assert target_path is within allowed write prefixes under workspace_path.
 * @param {string} workspacePath validated absolute path
 * @param {string} targetPath relative or absolute path to be written
 */
export function assertWriteConfined(workspacePath, targetPath) {
  const abs = isAbsolute(targetPath) ? resolve(targetPath) : resolve(workspacePath, targetPath);
  const rel = relative(workspacePath, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new InvalidWorkspaceError('Target path escapes workspace boundary', {
      details: { reason: 'traversal_attempt', workspace: workspacePath, target: abs },
    });
  }
  if (!rel) {
    throw new InvalidWorkspaceError('Target path is workspace root itself', {
      details: { reason: 'root_write', target: abs },
    });
  }
  const parts = rel.split(/[\\/]/).filter(Boolean);
  const top = parts[0];
  if (parts.length > 1 && !ALLOWED_WRITE_PREFIXES.includes(top)) {
    throw new InvalidWorkspaceError(`Target top dir '${top}' not in allowed list`, {
      details: { reason: 'disallowed_prefix', target: abs, top_dir: top, allowed: ALLOWED_WRITE_PREFIXES },
      fixHint: `Writes restricted to: ${ALLOWED_WRITE_PREFIXES.join(', ')}/** or workspace-root config files.`,
    });
  }
}

export { MARKER_FILES, ALLOWED_WRITE_PREFIXES };
