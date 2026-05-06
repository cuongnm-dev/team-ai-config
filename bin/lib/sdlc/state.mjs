// update_state — consolidated state mutation tool (port from sdlc/state.py).
//
// 6 ops via op discriminator: field, progress, kpi, log, status, stage_rollback.

import { promises as fs, existsSync } from 'node:fs';
import { isAbsolute, resolve as pathResolve, relative, dirname, join, basename } from 'node:path';

import * as io from './intel-io.mjs';
import { atomicWriteText, FileTransaction, withWorkspaceLock } from './concurrency.mjs';
import { ForbiddenError, InvalidInputError, NotFoundError, successResponse } from './errors.mjs';
import {
  getDotpath, readFrontmatter, serializeFrontmatter, setDotpath, writeFrontmatter,
} from './frontmatter.mjs';
import { validateWorkspacePath } from './path-validation.mjs';
import { bumpArtifact, readMeta, utcIsoNow, utcIsoNowFilename, utcIsoNowShort, writeMeta } from './versioning.mjs';

const VALID_OPS = ['field', 'progress', 'kpi', 'log', 'status', 'stage_rollback'];
const VALID_LOG_KINDS = ['escalation', 'wave', 'audit'];
const VALID_KPI_OPS = ['set', 'increment', 'append'];
const VALID_STATUSES = ['proposed', 'in-progress', 'blocked', 'done'];
const VALID_STAGES = ['ba', 'sa', 'designer', 'security', 'tech-lead', 'qa', 'reviewer', 'closed'];

export async function updateStateImpl(workspacePath, filePath, op, opts = {}) {
  const ws = validateWorkspacePath(workspacePath);

  if (!VALID_OPS.includes(op)) {
    throw new InvalidInputError(`Invalid op: ${JSON.stringify(op)} (expected one of ${VALID_OPS.join(', ')})`,
      { details: { op, valid: VALID_OPS } });
  }

  let target = isAbsolute(filePath) ? pathResolve(filePath) : pathResolve(ws, filePath);
  if (!existsSync(target)) {
    throw new NotFoundError(`State file not found: ${filePath}`, { details: { file_path: filePath, resolved: target } });
  }

  return await withWorkspaceLock(ws, async () => {
    if (op === 'field')         return opField(ws, target, opts);
    if (op === 'progress')      return opProgress(ws, target, opts);
    if (op === 'kpi')           return opKpi(ws, target, opts);
    if (op === 'log')           return opLog(ws, target, opts);
    if (op === 'status')        return opStatus(ws, target, opts);
    if (op === 'stage_rollback')return opStageRollback(ws, target, opts);
    throw new InvalidInputError(`Unhandled op: ${op}`, { details: { op } });
  });
}

// ─── op=field ───

async function opField(ws, target, opts) {
  const { field_path, field_value } = opts;
  if (!field_path) throw new InvalidInputError('op=field requires field_path', { details: { missing: ['field_path'] } });
  if (!('field_value' in opts)) throw new InvalidInputError('op=field requires field_value', { details: { missing: ['field_value'] } });

  const [fm, body] = await readFrontmatter(target);
  const allLocked = new Set([...(fm['locked-fields'] || []), ...(fm['locked_fields'] || [])]);

  if (allLocked.has(field_path)) {
    throw new ForbiddenError(`Field ${JSON.stringify(field_path)} is in locked_fields`, {
      details: { field_path, locked_fields: [...allLocked].sort() },
      fixHint: 'Remove field from locked-fields list first, OR use a different field.',
    });
  }
  const [oldValue, newValue] = setDotpath(fm, field_path, field_value);
  fm['last-updated'] = utcIsoNow();
  await writeFrontmatter(target, fm, body);

  return successResponse({
    file_path: relative(ws, target).replace(/\\/g, '/'),
    op: 'field', field_path,
    old_value: oldValue, new_value: newValue,
  });
}

// ─── op=progress ───

async function opProgress(ws, target, opts) {
  const { stage, verdict, artifact = '', date = utcIsoNowShort() } = opts;
  if (!stage || !verdict) {
    throw new InvalidInputError('op=progress requires stage + verdict', {
      details: { missing: [stage ? null : 'stage', verdict ? null : 'verdict'].filter(Boolean) },
    });
  }
  const [fm, body] = await readFrontmatter(target);
  const newBody = appendTableRow(body, 'Stage Progress', [stage, stage, verdict, artifact, date]);
  fm['last-updated'] = utcIsoNow();
  await writeFrontmatter(target, fm, newBody);

  return successResponse({
    file_path: relative(ws, target).replace(/\\/g, '/'),
    op: 'progress', stage, verdict, artifact, date,
  });
}

function appendTableRow(body, sectionHeader, cells) {
  const lines = body.split('\n');
  let sectionIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().toLowerCase() === `## ${sectionHeader}`.toLowerCase()) {
      sectionIdx = i;
      break;
    }
  }
  const newRow = '| ' + cells.map(String).join(' | ') + ' |';

  if (sectionIdx === -1) {
    return body.trimEnd() + `\n\n## ${sectionHeader}\n\n${newRow}\n`;
  }

  let nextSectionIdx = lines.length;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { nextSectionIdx = i; break; }
  }
  let tableStart = -1, tableEnd = -1;
  for (let i = sectionIdx + 1; i < nextSectionIdx; i++) {
    if (lines[i].startsWith('|')) {
      if (tableStart === -1) tableStart = i;
      tableEnd = i;
    }
  }

  if (tableStart === -1) {
    const skeleton = `\n| # | Stage | Agent | Verdict | Artifact | Date |\n|---|---|---|---|---|---|\n${newRow}\n`;
    return lines.slice(0, sectionIdx + 1).join('\n') + skeleton + lines.slice(sectionIdx + 1).join('\n');
  }
  return lines.slice(0, tableEnd + 1).join('\n') + '\n' + newRow + '\n' + lines.slice(tableEnd + 1).join('\n');
}

// ─── op=kpi ───

async function opKpi(ws, target, opts) {
  const { metric, delta_value, kpi_op = 'set' } = opts;
  if (!metric) throw new InvalidInputError('op=kpi requires metric', { details: { missing: ['metric'] } });
  if (!('delta_value' in opts)) throw new InvalidInputError('op=kpi requires delta_value', { details: { missing: ['delta_value'] } });
  if (!VALID_KPI_OPS.includes(kpi_op)) throw new InvalidInputError(`Invalid kpi_op: ${JSON.stringify(kpi_op)}`, { details: { kpi_op, valid: VALID_KPI_OPS } });

  const [fm, body] = await readFrontmatter(target);
  if (!fm.kpi) fm.kpi = {};
  const dotpath = `kpi.${metric}`;
  const old = getDotpath(fm, dotpath);
  let newVal;

  if (kpi_op === 'set') {
    setDotpath(fm, dotpath, delta_value);
    newVal = delta_value;
  } else if (kpi_op === 'increment') {
    if (typeof old !== 'number' && old !== null && old !== undefined) {
      throw new InvalidInputError(`Cannot increment non-numeric kpi ${JSON.stringify(metric)}: current=${JSON.stringify(old)}`,
        { details: { metric, current: old, delta: delta_value } });
    }
    newVal = (old || 0) + delta_value;
    setDotpath(fm, dotpath, newVal);
  } else { // append
    if (old === null || old === undefined) {
      newVal = [delta_value];
    } else if (Array.isArray(old)) {
      newVal = [...old, delta_value];
    } else {
      throw new InvalidInputError(`Cannot append to non-list kpi ${JSON.stringify(metric)}: current=${JSON.stringify(old)}`,
        { details: { metric, current_type: typeof old } });
    }
    setDotpath(fm, dotpath, newVal);
  }
  fm['last-updated'] = utcIsoNow();
  await writeFrontmatter(target, fm, body);

  return successResponse({
    file_path: relative(ws, target).replace(/\\/g, '/'),
    op: 'kpi', metric, kpi_op,
    old_value: old, new_value: newVal,
  });
}

// ─── op=log ───

async function opLog(ws, target, opts) {
  const { log_kind, entry } = opts;
  if (!log_kind) throw new InvalidInputError('op=log requires log_kind', { details: { missing: ['log_kind'] } });
  if (!VALID_LOG_KINDS.includes(log_kind)) throw new InvalidInputError(`Invalid log_kind: ${JSON.stringify(log_kind)}`, { details: { log_kind, valid: VALID_LOG_KINDS } });
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new InvalidInputError('op=log requires entry (object)', { details: { entry_type: Array.isArray(entry) ? 'array' : typeof entry } });
  }

  const sectionHeader = { escalation: 'Escalation Log', wave: 'Wave Tracker', audit: 'Audit Log' }[log_kind];

  const [fm, body] = await readFrontmatter(target);
  const cells = entryToCells(log_kind, entry);
  const newBody = appendTableRow(body, sectionHeader, cells);
  fm['last-updated'] = utcIsoNow();
  await writeFrontmatter(target, fm, newBody);

  return successResponse({
    file_path: relative(ws, target).replace(/\\/g, '/'),
    op: 'log', log_kind, appended: entry,
  });
}

function entryToCells(logKind, entry) {
  if (logKind === 'escalation') {
    return [entry.date || utcIsoNowShort(), entry.item || '', entry.decision || ''];
  }
  if (logKind === 'wave') {
    return [String(entry.wave || ''), String(entry.tasks || ''), entry.dev_status || '', entry.qa_status || ''];
  }
  return [entry.date || utcIsoNowShort(), entry.actor || '', entry.action || '', entry.note || ''];
}

// ─── op=status (atomic cross-file) ───

async function opStatus(ws, target, opts) {
  const { entity_id, status: newStatus, evidence } = opts;
  if (!entity_id || !newStatus) {
    throw new InvalidInputError('op=status requires entity_id + status', {
      details: { missing: [entity_id ? null : 'entity_id', newStatus ? null : 'status'].filter(Boolean) },
    });
  }
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new InvalidInputError(`Invalid status: ${JSON.stringify(newStatus)}`, { details: { status: newStatus, valid: VALID_STATUSES } });
  }

  const [fm, body] = await readFrontmatter(target);
  const oldStatus = fm.status;
  fm.status = newStatus;
  fm['last-updated'] = utcIsoNow();
  const stateMdContent = serializeFrontmatter(fm, body);

  let catalogPath, catalog, entity, catalogKey;
  if (entity_id.startsWith('M-')) {
    catalogPath = io.moduleCatalogPath(ws);
    catalog = await io.readModuleCatalog(ws);
    entity = io.findModule(catalog, entity_id);
    catalogKey = 'module-catalog.json';
  } else if (entity_id.startsWith('F-')) {
    catalogPath = io.featureCatalogPath(ws);
    catalog = await io.readFeatureCatalog(ws);
    entity = io.findFeature(catalog, entity_id);
    catalogKey = 'feature-catalog.json';
  } else {
    // Hotfix or unknown — only update _state.md
    await atomicWriteText(target, stateMdContent);
    return successResponse({
      file_path: relative(ws, target).replace(/\\/g, '/'),
      op: 'status', entity_id, old_status: oldStatus, new_status: newStatus,
      catalog_updated: false,
    });
  }

  if (!entity) {
    throw new NotFoundError(`Entity ${entity_id} not found in ${catalogKey}`, { details: { entity_id, catalog: catalogKey } });
  }

  entity.status = newStatus;
  if (evidence) {
    if (!entity.implementation_evidence) entity.implementation_evidence = {};
    Object.assign(entity.implementation_evidence, evidence);
  }
  const catalogContent = io.serializeJson(catalog);

  const tx = new FileTransaction();
  tx.add(target, stateMdContent);
  tx.add(catalogPath, catalogContent);
  await tx.commit();

  const meta = await readMeta(ws);
  const newV = bumpArtifact(meta, catalogKey, { content: catalogContent, producer: 'ai-kit/update_state' });
  await writeMeta(ws, meta);

  return successResponse({
    file_path: relative(ws, target).replace(/\\/g, '/'),
    op: 'status', entity_id, old_status: oldStatus, new_status: newStatus,
    catalog_updated: true, new_catalog_version: newV,
  });
}

// ─── op=stage_rollback ───

async function opStageRollback(ws, target, opts) {
  const {
    target_stage, archive_artifacts = true,
    reopened_reason = 'stage_rollback via update_state',
    force = false,
  } = opts;

  if (!target_stage) throw new InvalidInputError('op=stage_rollback requires target_stage', { details: { missing: ['target_stage'] } });
  if (!VALID_STAGES.includes(target_stage)) throw new InvalidInputError(`Invalid target_stage: ${JSON.stringify(target_stage)}`, { details: { target_stage, valid: VALID_STAGES } });

  const [fm, body] = await readFrontmatter(target);
  const oldStatus = fm.status;
  const oldCurrentStage = fm['current-stage'];
  const completedStages = fm['completed-stages'] || {};
  const stagesQueue = fm['stages-queue'] || [];
  let reworkCount = fm['rework-count'] || {};

  const completedKeys = (completedStages && typeof completedStages === 'object' && !Array.isArray(completedStages))
    ? Object.keys(completedStages) : [];
  if (!completedKeys.includes(target_stage) && target_stage !== oldCurrentStage) {
    throw new InvalidInputError(`Stage ${JSON.stringify(target_stage)} not in completed-stages or current-stage`, {
      details: { target_stage, completed_stages: completedKeys, current_stage: oldCurrentStage },
    });
  }

  const targetRework = (typeof reworkCount === 'object' && reworkCount !== null) ? (reworkCount[target_stage] || 0) : 0;
  if (targetRework >= 2 && !force) {
    throw new ForbiddenError(`Stage ${target_stage} has rework-count=${targetRework}. Pass force=true to override.`, {
      details: { target_stage, rework_count: targetRework, hint: 'Re-invoke with force=true if intentional' },
    });
  }

  const newCompleted = {};
  const popped = [];
  if (typeof completedStages === 'object' && !Array.isArray(completedStages) && completedStages !== null) {
    let foundTarget = false;
    for (const stageName of Object.keys(completedStages)) {
      if (foundTarget) {
        popped.push(stageName);
      } else if (stageName === target_stage) {
        popped.push(stageName);
        foundTarget = true;
      } else {
        newCompleted[stageName] = completedStages[stageName];
      }
    }
  }
  const newStagesQueue = [...popped, ...(Array.isArray(stagesQueue) ? stagesQueue : [])];

  fm['completed-stages'] = newCompleted;
  fm['stages-queue'] = newStagesQueue;
  fm['current-stage'] = target_stage;
  fm['last-updated'] = utcIsoNow();

  let statusTransitioned = false;
  if (oldStatus === 'done') {
    fm.status = 'in-progress';
    fm['reopened-at'] = utcIsoNow();
    fm['reopened-reason'] = reopened_reason;
    statusTransitioned = true;
  } else if (oldStatus !== 'in-progress') {
    fm.status = 'in-progress';
  }

  if (typeof reworkCount !== 'object' || reworkCount === null || Array.isArray(reworkCount)) reworkCount = {};
  reworkCount[target_stage] = targetRework + 1;
  fm['rework-count'] = reworkCount;

  const stateMdContent = serializeFrontmatter(fm, body);

  const stamp = utcIsoNowFilename();
  const backupPath = join(dirname(target), `${basename(target)}.bak.${stamp}`);
  const backupContent = await fs.readFile(target, 'utf-8');

  const archivedPaths = [];
  if (archive_artifacts) {
    const archiveRoot = join(dirname(target), '.archive', stamp);
    for (const stageName of popped) {
      const stageDir = join(dirname(target), stageName);
      if (existsSync(stageDir)) {
        const stat = await fs.stat(stageDir);
        if (stat.isDirectory()) {
          const dest = join(archiveRoot, stageName);
          await fs.mkdir(dirname(dest), { recursive: true });
          await fs.rename(stageDir, dest);
          archivedPaths.push(relative(ws, dest).replace(/\\/g, '/'));
        }
      }
    }
  }

  const tx = new FileTransaction();
  tx.add(backupPath, backupContent);
  tx.add(target, stateMdContent);
  await tx.commit();

  const meta = await readMeta(ws);
  bumpArtifact(meta, relative(ws, target).replace(/\\/g, '/'),
    { content: stateMdContent, producer: 'ai-kit/update_state(stage_rollback)' });
  await writeMeta(ws, meta);

  return successResponse({
    file_path: relative(ws, target).replace(/\\/g, '/'),
    op: 'stage_rollback',
    old_current_stage: oldCurrentStage,
    new_current_stage: target_stage,
    old_status: oldStatus,
    new_status: fm.status,
    status_transitioned: statusTransitioned,
    popped_stages: popped,
    new_stages_queue: newStagesQueue,
    rework_count_after: reworkCount[target_stage],
    backup_path: relative(ws, backupPath).replace(/\\/g, '/'),
    archived_paths: archivedPaths,
  });
}
