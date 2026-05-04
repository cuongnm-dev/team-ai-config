// cursor-csv.mjs — Parse Cursor billing CSV exports (team-usage-events-*.csv).
//
// Cursor billing dashboard exports per-event usage with full token breakdown +
// authoritative cost. This is the most accurate cost source for Cursor work
// because Cursor's transcript jsonl files do NOT include token counts.
//
// CSV columns (verified 2026-05-04):
//   Date, User, Cloud Agent ID, Automation ID, Kind, Model, Max Mode,
//   Input (w/ Cache Write), Input (w/o Cache Write), Cache Read,
//   Output Tokens, Total Tokens, Cost
//
// Returns normalized events: { source, ts, model, tokens{}, cost_usd, kind, user }

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Cheap CSV parser — handles quoted fields with embedded commas, NOT embedded newlines
// (sufficient for Cursor's flat per-event format; throws on malformed rows).
const parseCsvLine = (line) => {
  const out = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuote = false;
      else cur += c;
    } else {
      if (c === '"') inQuote = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
};

// Auto-detect newest Cursor CSV in ~/Downloads matching pattern team-usage-events-*.csv
export const autoDetect = () => {
  const dl = path.join(os.homedir(), 'Downloads');
  if (!fs.existsSync(dl)) return null;
  let entries;
  try { entries = fs.readdirSync(dl, { withFileTypes: true }); } catch { return null; }
  const matches = entries
    .filter(e => e.isFile() && /^team-usage-events-.+\.csv$/i.test(e.name))
    .map(e => {
      const p = path.join(dl, e.name);
      try { return { p, mtime: fs.statSync(p).mtimeMs }; } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
  return matches.length ? matches[0].p : null;
};

// Parse a CSV file into normalized events
export const parse = (filePath, opts = {}) => {
  const { sinceMs = 0 } = opts;
  if (!filePath || !fs.existsSync(filePath)) return [];

  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (e) { console.error(`cursor-csv: cannot read ${filePath}: ${e.message}`); return []; }

  const lines = raw.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length < 2) return [];   // header + at least 1 row

  // Header row
  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const I = {
    date:        idx('Date'),
    user:        idx('User'),
    cloudAgent:  idx('Cloud Agent ID'),
    automation:  idx('Automation ID'),
    kind:        idx('Kind'),
    model:       idx('Model'),
    maxMode:     idx('Max Mode'),
    inputWithCw: idx('Input (w/ Cache Write)'),
    inputNoCw:   idx('Input (w/o Cache Write)'),
    cacheRead:   idx('Cache Read'),
    output:      idx('Output Tokens'),
    total:       idx('Total Tokens'),
    cost:        idx('Cost'),
  };

  // Sanity: required fields must be present
  if (I.date < 0 || I.model < 0 || I.cost < 0) {
    console.error(`cursor-csv: ${filePath} missing required columns (Date/Model/Cost) — header: ${headers.join(',')}`);
    return [];
  }

  const events = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < headers.length - 1) { skipped++; continue; }   // truncated row

    const ts = Date.parse(cols[I.date]);
    if (!ts || ts < sinceMs) { skipped++; continue; }

    const inWithCw = parseInt(cols[I.inputWithCw] || '0', 10) || 0;
    const inNoCw   = parseInt(cols[I.inputNoCw]   || '0', 10) || 0;
    const crT      = parseInt(cols[I.cacheRead]   || '0', 10) || 0;
    const outT     = parseInt(cols[I.output]      || '0', 10) || 0;
    const totT     = parseInt(cols[I.total]       || '0', 10) || (inWithCw + inNoCw + crT + outT);
    const cost     = parseFloat(cols[I.cost] || '0') || 0;

    events.push({
      source: 'cursor',
      ts,
      model: cols[I.model] || 'unknown',
      tokens: {
        input_fresh: inNoCw,
        input_cache_read: crT,
        input_cache_write: inWithCw,
        output: outT,
        total: totT,
      },
      cost_usd: cost,                   // authoritative — use as-is, don't recompute
      kind: cols[I.kind] || '',
      user: cols[I.user] || '',
      max_mode: (cols[I.maxMode] || '').toLowerCase() === 'yes',
      cloud_agent_id: cols[I.cloudAgent] || null,
      automation_id: cols[I.automation] || null,
    });
  }

  return events;
};

// Aggregate events by various dimensions for output
export const aggregate = (events) => {
  const result = {
    total_events: events.length,
    total_cost: 0,
    total_tokens: 0,
    by_model: {},
    by_user: {},
    by_kind: {},
    by_day: {},
    date_range: { from: null, to: null },
  };

  for (const e of events) {
    result.total_cost += e.cost_usd;
    result.total_tokens += e.tokens.total;

    const mb = result.by_model[e.model] ||= { events: 0, tokens: 0, cost: 0 };
    mb.events++; mb.tokens += e.tokens.total; mb.cost += e.cost_usd;

    if (e.user) {
      const ub = result.by_user[e.user] ||= { events: 0, tokens: 0, cost: 0 };
      ub.events++; ub.tokens += e.tokens.total; ub.cost += e.cost_usd;
    }

    const kb = result.by_kind[e.kind || 'unknown'] ||= { events: 0, tokens: 0, cost: 0 };
    kb.events++; kb.tokens += e.tokens.total; kb.cost += e.cost_usd;

    const day = new Date(e.ts).toISOString().slice(0, 10);
    const db = result.by_day[day] ||= { events: 0, tokens: 0, cost: 0 };
    db.events++; db.tokens += e.tokens.total; db.cost += e.cost_usd;

    if (!result.date_range.from || e.ts < result.date_range.from) result.date_range.from = e.ts;
    if (!result.date_range.to   || e.ts > result.date_range.to)   result.date_range.to = e.ts;
  }

  return result;
};

export default {
  source: 'cursor',
  description: 'Cursor billing CSV (team-usage-events-*.csv exported from Cursor dashboard)',
  detect: () => !!autoDetect(),
  autoDetect,
  parse,
  aggregate,
};
