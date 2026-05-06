// autofix command (port from sdlc/repair.py).

import { promises as fs } from 'node:fs';
import { relative } from 'node:path';

import { detectOrphanTmps, withWorkspaceLock } from './concurrency.mjs';
import { DestructiveNotConfirmedError, InvalidInputError, successResponse } from './errors.mjs';
import { validateWorkspacePath } from './path-validation.mjs';

const VALID_FIX_CLASSES = new Set(['orphan-removal', 'missing-scaffold', 'schema-migrate', 'id-collision-resolve', 'cross-ref-repair', 'all']);
const DESTRUCTIVE = new Set(['orphan-removal', 'id-collision-resolve']);

export async function autofixImpl(workspacePath, fixClasses, opts = {}) {
  const { dry_run = true, confirm_destructive = false } = opts;
  const ws = validateWorkspacePath(workspacePath);

  if (!fixClasses || !fixClasses.length) {
    throw new InvalidInputError('fix_classes is empty', { details: { fix_classes: fixClasses } });
  }
  const invalid = fixClasses.filter(c => !VALID_FIX_CLASSES.has(c));
  if (invalid.length) {
    throw new InvalidInputError(`Invalid fix_classes: ${invalid.join(', ')}`, {
      details: { invalid, valid: [...VALID_FIX_CLASSES].sort() },
    });
  }

  let classes = new Set(fixClasses);
  if (classes.has('all')) {
    classes = new Set([...VALID_FIX_CLASSES].filter(c => c !== 'all'));
  }

  if (!dry_run && !confirm_destructive) {
    const destructive = [...classes].filter(c => DESTRUCTIVE.has(c));
    if (destructive.length) {
      throw new DestructiveNotConfirmedError(
        `Destructive fix_classes require confirm_destructive=true: ${destructive.sort().join(', ')}`,
        { details: { destructive_classes: destructive.sort() }, fixHint: 'Set confirm_destructive=true OR use dry_run=true to preview.' },
      );
    }
  }

  const fixesPlanned = [];
  const fixesApplied = [];
  const unfixable = [];
  const requiresUserInput = [];

  const run = async () => {
    if (classes.has('orphan-removal')) {
      await planOrphanRemoval(ws, fixesPlanned, fixesApplied, dry_run);
    }
    if (classes.has('missing-scaffold')) {
      unfixable.push({ class: 'missing-scaffold', reason: "Requires verify(scopes=['structure', 'completeness']). Implementation deferred to P0.7." });
    }
    if (classes.has('schema-migrate')) {
      unfixable.push({ class: 'schema-migrate', reason: "Requires verify(scopes=['schemas']) + schema version detection. Deferred to P0.7." });
    }
    if (classes.has('id-collision-resolve')) {
      requiresUserInput.push({ class: 'id-collision-resolve', reason: "Manual decision needed. Will use verify(scopes=['id_uniqueness']) findings in P0.7." });
    }
    if (classes.has('cross-ref-repair')) {
      unfixable.push({ class: 'cross-ref-repair', reason: "Requires verify(scopes=['cross_references']) for FK gap list. Deferred to P0.7." });
    }
  };

  if (dry_run) {
    await run();
  } else {
    await withWorkspaceLock(ws, run);
  }

  return successResponse({
    dry_run, fixes_planned: fixesPlanned, fixes_applied: fixesApplied,
    unfixable, requires_user_input: requiresUserInput,
  });
}

async function planOrphanRemoval(ws, fixesPlanned, fixesApplied, dryRun) {
  const orphans = await detectOrphanTmps(ws, 'docs');
  for (const tmp of orphans) {
    const plan = {
      class: 'orphan-removal',
      file: relative(ws, tmp).replace(/\\/g, '/'),
      action: 'delete',
    };
    fixesPlanned.push(plan);
    if (!dryRun) {
      try {
        await fs.unlink(tmp);
        fixesApplied.push(plan);
      } catch (err) {
        plan.error = err.message;
      }
    }
  }
}
