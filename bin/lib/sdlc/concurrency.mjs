// Concurrency primitives (port from Python sdlc/concurrency.py).
//
//   §2.2 Atomic write: write .tmp → fsync → rename
//   §2.3 Per-workspace lock: serialize writes per workspace_path (in-process)
//   §2.4 Multi-file transaction: write all .tmp → verify → rename in order

import { promises as fs, existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { TransactionFailedError } from './errors.mjs';

// ─── §2.3 Per-workspace lock registry (in-process Mutex via Promise chain) ───

const _locks = new Map(); // workspace key → tail Promise

/**
 * Acquire a per-workspace lock. Returns release fn.
 * Multiple writers on same workspace serialize via Promise chain.
 * @param {string} workspacePath
 * @returns {Promise<() => void>}
 */
export async function acquireWorkspaceLock(workspacePath) {
  const key = String(workspacePath);
  const prev = _locks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => { release = resolve; });
  _locks.set(key, prev.then(() => next));
  await prev;
  return () => {
    release();
    if (_locks.get(key) === prev.then(() => next)) {
      _locks.delete(key);
    }
  };
}

/**
 * Run fn under workspace lock. Auto-release on completion or error.
 * @template T
 * @param {string} workspacePath
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withWorkspaceLock(workspacePath, fn) {
  const release = await acquireWorkspaceLock(workspacePath);
  try {
    return await fn();
  } finally {
    release();
  }
}

// ─── §2.2 Atomic single-file write ───

/**
 * Atomic write: stage to .tmp → fsync → rename.
 * @param {string} target absolute path
 * @param {Buffer|string} content
 * @param {string} [encoding] used if content is string
 */
export async function atomicWrite(target, content, encoding = 'utf-8') {
  await fs.mkdir(dirname(target), { recursive: true });
  const tmp = target + '.tmp';
  const buf = typeof content === 'string' ? Buffer.from(content, encoding) : content;
  let fh;
  try {
    fh = await fs.open(tmp, 'w');
    await fh.writeFile(buf);
    await fh.sync();
  } finally {
    if (fh) await fh.close();
  }
  try {
    await fs.rename(tmp, target);
  } catch (err) {
    try { await fs.unlink(tmp); } catch {}
    throw err;
  }
}

export const atomicWriteText = atomicWrite;

// ─── §2.4 Multi-file transaction ───

export class FileTransaction {
  constructor() {
    this._pending = [];   // [{target, content (Buffer)}]
    this._tmps = [];      // staged .tmp paths
    this._renamed = [];   // [tmp, final] for rollback log
  }

  /**
   * Stage a file write.
   * @param {string} target absolute path
   * @param {Buffer|string} content
   * @param {string} [encoding]
   */
  add(target, content, encoding = 'utf-8') {
    const buf = typeof content === 'string' ? Buffer.from(content, encoding) : content;
    this._pending.push({ target, content: buf });
  }

  /**
   * Commit all staged writes atomically.
   * @param {(staged: Array<{target: string, content: Buffer}>) => Promise<string[]>|string[]} [verify]
   * @returns {Promise<string[]>} final paths written.
   */
  async commit(verify = null) {
    // Step 1: write all .tmp
    for (const { target, content } of this._pending) {
      await fs.mkdir(dirname(target), { recursive: true });
      const tmp = target + '.tmp';
      let fh;
      try {
        fh = await fs.open(tmp, 'w');
        await fh.writeFile(content);
        await fh.sync();
        this._tmps.push(tmp);
      } catch (err) {
        if (fh) try { await fh.close(); } catch {}
        await this._cleanupTmps();
        throw new TransactionFailedError(`Failed to write ${tmp}: ${err.message}`, {
          details: { phase: 'write_tmp', target },
        });
      } finally {
        if (fh) try { await fh.close(); } catch {}
      }
    }

    // Step 2: verify gate
    if (verify) {
      let errors;
      try {
        errors = await verify(this._pending);
      } catch (err) {
        await this._cleanupTmps();
        throw new TransactionFailedError(`Verify callback raised: ${err.message}`, {
          details: { phase: 'verify', exception: err.message },
        });
      }
      if (errors && errors.length > 0) {
        await this._cleanupTmps();
        throw new TransactionFailedError(`Verify gate rejected transaction: ${errors.length} error(s)`, {
          details: { phase: 'verify', errors },
        });
      }
    }

    // Step 3: rename all .tmp → final in order
    const finals = [];
    for (let i = 0; i < this._pending.length; i++) {
      const { target } = this._pending[i];
      const tmp = this._tmps[i];
      try {
        await fs.rename(tmp, target);
        this._renamed.push([tmp, target]);
        finals.push(target);
      } catch (err) {
        await this._cleanupTmps();
        throw new TransactionFailedError(`Rename failed mid-transaction: ${err.message}`, {
          details: {
            phase: 'rename',
            completed_renames: this._renamed.map(([_, t]) => t),
            failed_at: target,
            remaining: this._pending.slice(i + 1).map(p => p.target),
          },
          fixHint: 'Run autofix(fix_classes=["orphan-removal"]) to clean up.',
        });
      }
    }
    return finals;
  }

  async _cleanupTmps() {
    for (const tmp of this._tmps) {
      if (existsSync(tmp)) {
        try { await fs.unlink(tmp); } catch {}
      }
    }
    this._tmps = [];
  }
}

/**
 * Find .tmp files left over from failed transactions.
 * @param {string} workspacePath
 * @param {string} [subdir]
 * @returns {Promise<string[]>}
 */
export async function detectOrphanTmps(workspacePath, subdir = 'docs') {
  const root = `${workspacePath}/${subdir}`;
  if (!existsSync(root)) return [];
  const orphans = [];
  await walkAsync(root, (path) => {
    if (path.endsWith('.tmp')) orphans.push(path);
  });
  return orphans;
}

async function walkAsync(dir, visit) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walkAsync(full, visit);
    else visit(full);
  }
}
