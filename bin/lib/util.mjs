// Pure utility functions — no side effects, no I/O. Safe to unit test.

// ─── Number / currency formatting ─────────────────────────────────────
export const fmtN = (n) => {
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n|0);
};

export const fmtInt = (n) => Math.round(n).toLocaleString('vi-VN');

export const fmtUsd = (n) => {
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v < 1) return sign + '$' + v.toFixed(3);
  return sign + '$' + v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

export const fmtPct = (n) => n.toFixed(1) + '%';

// ─── Time window parsing ─────────────────────────────────────────────
// Format: 7d, 30d, 24h, 12w, 3m. Default 30 days.
export const parseSince = (s, now = Date.now()) => {
  if (!s) return now - 30*86400_000;
  const m = String(s).match(/^(\d+)([dwmh])$/);
  if (!m) return now - 30*86400_000;
  const n = parseInt(m[1], 10);
  const mult = {h: 3600_000, d: 86400_000, w: 7*86400_000, m: 30*86400_000}[m[2]];
  return now - n * mult;
};

// ─── Anthropic pricing (USD per 1M tokens) ───────────────────────────
export const PRICING = {
  'claude-opus-4':    {in: 15,   out: 75, cr: 1.50, cw: 18.75},
  'claude-sonnet-4':  {in:  3,   out: 15, cr: 0.30, cw:  3.75},
  'claude-haiku-4':   {in:  0.8, out:  4, cr: 0.08, cw:  1.00},
  'claude-3-5-sonnet':{in:  3,   out: 15, cr: 0.30, cw:  3.75},
  'claude-3-5-haiku': {in:  0.8, out:  4, cr: 0.08, cw:  1.00},
  default:            {in:  3,   out: 15, cr: 0.30, cw:  3.75},
};

export const priceOf = (model) => {
  if (!model) return PRICING.default;
  for (const k of Object.keys(PRICING)) if (k !== 'default' && model.startsWith(k)) return PRICING[k];
  return PRICING.default;
};

export const costOf = (model, u) => {
  const p = priceOf(model);
  return ((u.input_tokens||0)*p.in + (u.output_tokens||0)*p.out
        + (u.cache_read_input_tokens||0)*p.cr
        + (u.cache_creation_input_tokens||0)*p.cw) / 1_000_000;
};

// ─── Error classification ────────────────────────────────────────────
// → {category: 'workflow'|'shell_real'|'shell_noise'|'http'|'other', isReal: bool, msg: string}
export const classifyError = (toolName, errorText, command) => {
  const txt = (errorText || '').slice(0, 500);
  const cmd = (command || '').toLowerCase();
  const firstLine = txt.split('\n')[0].trim();

  if (txt.includes('<tool_use_error>') ||
      /File has not been read yet|String to replace not found|String not found in file|Cannot find file|Did you mean/i.test(txt)) {
    return {category: 'workflow', isReal: true, msg: firstLine.slice(0, 80)};
  }

  if (/status code [4-5]\d\d|HTTP \d\d\d|404 Not Found|403 Forbidden|500 Internal/i.test(txt)) {
    return {category: 'http', isReal: true, msg: firstLine.slice(0, 80)};
  }

  if (toolName === 'Bash' || toolName === 'PowerShell') {
    const exitMatch = txt.match(/[Ee]xit code:?\s*(\d+)/);
    const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : null;

    if (exitCode !== null && exitCode >= 2) {
      return {category: 'shell_real', isReal: true, msg: firstLine.slice(0, 80)};
    }

    if (exitCode === 1 || (exitCode === null && /exit code 1/i.test(txt))) {
      if (
        /\b(grep|rg|ripgrep|ag|ack)\b/.test(cmd) ||
        /select-string/.test(cmd) ||
        /\bfindstr\b/.test(cmd) ||
        /git\s+diff\s+(--quiet|--exit-code)/.test(cmd) ||
        /\btest\s+[-!]|^\s*\[\s/.test(cmd) ||
        /\| grep\b/.test(cmd) ||
        /xargs.*grep/.test(cmd)
      ) {
        return {category: 'shell_noise', isReal: false, msg: `(${cmd.split(/\s+/)[0] || 'cmd'} no-match, exit 1)`};
      }
      if (txt.length < 50 && /^\s*(stderr:)?\s*$/im.test(txt)) {
        return {category: 'shell_noise', isReal: false, msg: '(empty output, exit 1)'};
      }
    }

    return {category: 'shell_real', isReal: true, msg: firstLine.slice(0, 80)};
  }

  return {category: 'other', isReal: true, msg: firstLine.slice(0, 80)};
};

// ─── Did-you-mean (Levenshtein) ──────────────────────────────────────
import { distance } from 'fastest-levenshtein';
export const suggestCommand = (input, knownCommands) => {
  if (!input) return [];
  return knownCommands
    .map(c => ({c, d: distance(input, c)}))
    .filter(x => x.d <= Math.max(2, Math.floor(input.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.c);
};

// ─── Visible-length string helpers (ANSI-aware) ──────────────────────
export const vlen = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '').length;
export const padR = (s, w) => s + ' '.repeat(Math.max(0, w - vlen(s)));
export const padL = (s, w) => ' '.repeat(Math.max(0, w - vlen(s))) + s;

// ─── Sparkline ───────────────────────────────────────────────────────
export const sparkline = (values) => {
  const blocks = '▁▂▃▄▅▆▇█';
  const max = Math.max(...values, 0.0001);
  return values.map(v => v <= 0 ? ' ' : blocks[Math.min(7, Math.floor((v / max) * 7))]).join('');
};

export const bar = (ratio, width = 12) => {
  const r = Math.max(0, Math.min(1, ratio));
  const blocks = '▏▎▍▌▋▊▉█';
  const total = r * width;
  const full = Math.floor(total);
  const partial = Math.round((total - full) * 8);
  let out = '█'.repeat(full);
  if (partial > 0 && full < width) out += blocks[partial - 1];
  return padR(out, width);
};
