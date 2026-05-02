#!/usr/bin/env node
// ai-kit — Team AI config manager (Node.js + Ink TUI)
// One file MVP. Split into modules later as it grows.

import { execa, execaSync } from 'execa';
import { Box, render, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React, { useEffect, useState } from 'react';
import { Listr } from 'listr2';
import boxen from 'boxen';
import figlet from 'figlet';
import { select } from '@inquirer/prompts';
import {
  fmtN, fmtInt, fmtUsd, fmtPct,
  parseSince, priceOf, costOf,
  classifyError, suggestCommand,
  vlen, padR, padL, sparkline, bar,
} from './lib/util.mjs';

const _pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const VERSION = _pkg.version;
const AI_KIT_HOME = process.env.AI_KIT_HOME || path.join(os.homedir(), '.ai-kit');

// Maintainer mode — owner-only commands (pack, publish, diff, edit, reset)
// hide from menu/help unless AI_KIT_MAINTAINER=1 or ~/.ai-kit/.maintainer touched.
const IS_MAINTAINER = process.env.AI_KIT_MAINTAINER === '1' ||
  fs.existsSync(path.join(AI_KIT_HOME, '.maintainer'));
const MAINTAINER_COMMANDS = new Set(['pack', 'publish', 'diff', 'edit', 'reset']);
const REPO_DIR = path.join(AI_KIT_HOME, 'team-ai-config');
const BIN_DIR = path.join(AI_KIT_HOME, 'bin');
const UPDATE_CACHE = path.join(AI_KIT_HOME, '.update-check');

// ─── Global flags (parsed early, stripped before dispatch) ─────────────
const _rawArgs = process.argv.slice(2);
const _quietIdx = _rawArgs.findIndex(a => a === '--quiet' || a === '-q');
const QUIET = _quietIdx !== -1;
if (QUIET) _rawArgs.splice(_quietIdx, 1);

// ─── NO_COLOR / isTTY (https://no-color.org) ────────────────────────────
const USE_COLOR = (process.stdout.isTTY !== false || process.env.FORCE_COLOR === '1')
  && !Object.prototype.hasOwnProperty.call(process.env, 'NO_COLOR')
  && process.env.FORCE_COLOR !== '0';
const _a = s => USE_COLOR ? s : '';

// ─── Truecolor gradient ─────────────────────────────────────────────────
const USE_TRUECOLOR = USE_COLOR && (
  process.env.COLORTERM === 'truecolor' ||
  process.env.COLORTERM === '24bit' ||
  !!process.env.WT_SESSION ||        // Windows Terminal
  !!process.env.TERM_PROGRAM         // iTerm2 / Hyper / VS Code integrated terminal
);
const _lerp = (a, b, t) => Math.round(a + (b - a) * t);
const _tc   = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;
// gradient(text, [[r,g,b],...]) — multi-stop, Unicode-safe, spaces uncolored
const gradient = (text, stops) => {
  if (!USE_TRUECOLOR || stops.length < 2) return USE_COLOR ? `\x1b[1;36m${text}\x1b[0m` : text;
  const chars = [...text];
  const n = chars.length;
  const segs = stops.length - 1;
  return chars.map((ch, i) => {
    if (ch === ' ') return ch;
    const pos = (n < 2 ? 0 : i / (n - 1)) * segs;
    const s = Math.min(Math.floor(pos), segs - 1);
    const t = pos - s;
    const [r1,g1,b1] = stops[s], [r2,g2,b2] = stops[s+1];
    return `${_tc(_lerp(r1,r2,t), _lerp(g1,g2,t), _lerp(b1,b2,t))}${ch}`;
  }).join('') + '\x1b[0m';
};
// ai-kit brand: electric cyan → indigo → vivid violet
const BRAND = [[0,229,255], [41,121,255], [170,0,255]];
const brand = text => gradient(text, BRAND);

const h = React.createElement;

// ─── Theme ─────────────────────────────────────────────────────────────
const T = {
  primary: 'cyan',
  accent: 'magenta',
  success: 'green',
  warn: 'yellow',
  danger: 'red',
  dim: 'gray',
};

// ─── marked-terminal setup ─────────────────────────────────────────────
const _cols = () => Math.min(process.stdout.columns || 100, 100);
marked.use(markedTerminal({reflowText: true, width: _cols()}, {useNewRenderer: true}));
// Override heading + code renderers — only when color output is active
if (USE_COLOR) marked.use({
  renderer: {
    heading({tokens, depth}) {
      const text = this.parser.parseInline(tokens);
      const plain = text.replace(/\x1b\[[0-9;]*m/g, '');
      const w = _cols();
      if (depth === 1) {
        const bar = '═'.repeat(Math.min(plain.length + 2, w - 4));
        return `\n\x1b[1;36m  ${text}\x1b[0m\n\x1b[2;36m  ${bar}\x1b[0m\n\n`;
      }
      if (depth === 2) {
        const bar = '─'.repeat(Math.min(plain.length + 2, w - 4));
        return `\n\x1b[1;35m  ${text}\x1b[0m\n\x1b[2;35m  ${bar}\x1b[0m\n\n`;
      }
      if (depth === 3) return `\n\x1b[1;33m  ${text}\x1b[0m\n`;
      return `\n\x1b[1m  ${text}\x1b[0m\n`;
    },
    code({text, lang}) {
      const w = _cols();
      const bar = '─'.repeat(w - 6);
      const header = lang
        ? `\x1b[2m  ┌─ ${lang} ${'─'.repeat(Math.max(2, w - lang.length - 9))}┐\x1b[0m`
        : `\x1b[2m  ┌─${bar}─┐\x1b[0m`;
      const body = text.trimEnd().split('\n').map(l => `\x1b[2m  │\x1b[0m \x1b[33m${l}\x1b[0m`).join('\n');
      return `${header}\n${body}\n\x1b[2m  └─${bar}─┘\x1b[0m\n\n`;
    },
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────
const exists = p => { try { return fs.existsSync(p); } catch { return false; } };
const ensureRepo = () => {
  if (!exists(path.join(REPO_DIR, '.git'))) {
    console.error(`${_a('\x1b[31m')}  ✗ team-ai-config not found at ${REPO_DIR}${_a('\x1b[0m')}`);
    console.error(`${_a('\x1b[31m')}  ✗ Run bootstrap: irm .../bootstrap.ps1 | iex (Windows) or curl ... | bash (Mac/Linux)${_a('\x1b[0m')}`);
    process.exit(1);
  }
};
const cmdAvail = c => {
  try {
    execaSync(process.platform === 'win32' ? 'where' : 'which', [c], {stdio: 'ignore'});
    return true;
  } catch { return false; }
};
const gitOut = (...args) => {
  try {
    return execaSync('git', ['-C', REPO_DIR, ...args]).stdout.trim();
  } catch { return ''; }
};
const stripFm = c => c.replace(/^---[\s\S]*?---\n*/, '');
const cleanDesc = d => (d || '')
  .replace(/^["']|["']$/g, '')
  .replace(/^\[[^\]]+\]\s*/, '');

// ─── UI Components ─────────────────────────────────────────────────────
const Header = ({title, subtitle}) => h(Box, {flexDirection: 'column', marginBottom: 1},
  h(Box, {borderStyle: 'round', borderColor: T.primary, paddingX: 1},
    h(Text, {bold: true}, brand(title))
  ),
  subtitle && h(Box, {marginLeft: 1}, h(Text, {color: T.dim}, subtitle))
);

const Section = ({title, children}) => h(Box, {flexDirection: 'column', marginBottom: 1},
  h(Text, {bold: true, color: T.accent}, title),
  h(Box, {flexDirection: 'column', marginLeft: 2}, children)
);

const Row = ({icon, label, value, color}) => h(Box, null,
  icon && h(Text, {color: color || T.dim}, icon + ' '),
  h(Text, {color: T.dim}, label.padEnd(16)),
  h(Text, {color: color || 'white'}, value || '')
);

const Ok = ({children}) => h(Text, {color: T.success}, '✓ ', children);
const Err = ({children}) => h(Text, {color: T.danger}, '✗ ', children);
const Warn = ({children}) => h(Text, {color: T.warn}, '⚠ ', children);

const DocItem = ({item}) => h(Box, {paddingLeft: 2},
  h(Text, {color: T.dim}, '  › '),
  h(Text, {color: T.primary}, item.name.padEnd(24)),
  h(Text, {color: T.dim}, item.title || '')
);

// ─── Commands ──────────────────────────────────────────────────────────

const Help = () => h(Box, {flexDirection: 'column', padding: 1},
  h(Header, {title: `ai-kit ${VERSION}`, subtitle: 'Team AI config manager'}),
  h(Section, {title: 'User commands'},
    h(Row, {label: 'install', value: 'First-time setup (use bootstrap)'}),
    h(Row, {label: 'update | up', value: 'Pull team config + redeploy + refresh MCP'}),
    h(Row, {label: 'status | st', value: 'Versions + deployed counts + MCP health'}),
    h(Row, {label: 'logs', value: 'Tail MCP container logs'}),
    h(Row, {label: 'doctor | dr', value: 'Verify deps + paths'}),
    h(Row, {label: 'statistics | stats', value: 'Top skills/agents/tokens/cost (local-only)'}),
    h(Row, {label: 'verify [--restore]', value: 'Kiểm tra toàn vẹn agents/skills (manifest SHA256)'}),
    h(Row, {label: 'search <term>', value: 'Tìm xuyên docs+agents+skills (--scope)'}),
    h(Row, {label: 'config get|set|list', value: 'Quản lý ~/.ai-kit/{billing,alerts}.json'}),
    h(Row, {label: 'schedule update', value: 'Cron/Task Scheduler tự động update'}),
    h(Row, {label: 'version | -v', value: 'Show ai-kit + team-config + MCP versions'})
  ),
  h(Section, {title: 'Documentation'},
    h(Row, {label: 'doc', value: 'Show docs index'}),
    h(Row, {label: 'doc <topic>', value: 'Mở trang tài liệu cụ thể'}),
    h(Row, {label: 'doc skills', value: 'Danh mục skills (đã chọn lọc)'}),
    h(Row, {label: 'doc agents', value: 'Danh mục agents (đã chọn lọc)'}),
    h(Row, {label: 'doc --search <t>', value: 'Tìm kiếm xuyên docs + agents + skills'})
  ),
  h(Section, {title: 'MCP control'},
    h(Row, {label: 'mcp <verb>', value: 'start | stop | restart | logs | pull | status'})
  ),
  h(Section, {title: 'Backups'},
    h(Row, {label: 'list-backups', value: 'List ai-config-backup-* (created on every update)'}),
    h(Row, {label: 'rollback [N]', value: 'Restore from backup (default newest); auto-snapshots before'}),
    h(Row, {label: 'clean [--keep N] --yes', value: 'Delete old backups + scoped docker image prune'})
  ),
  IS_MAINTAINER ? h(Section, {title: 'Maintainer (owner only)'},
    h(Row, {label: 'pack', value: 'Snapshot ~/ → repo'}),
    h(Row, {label: 'publish "<msg>"', value: 'pack + git commit + push'}),
    h(Row, {label: 'diff', value: 'Show local vs repo deltas'}),
    h(Row, {label: 'edit', value: 'Open repo in $EDITOR'}),
    h(Row, {label: 'reset [--yes]', value: 'Discard local repo edits + pull'})
  ) : null,
  h(Section, {title: 'Misc'},
    h(Row, {label: 'upgrade | upg', value: 'npm update Node.js deps in ~/.ai-kit'}),
    h(Row, {label: 'uninstall [--yes]', value: 'Remove ~/.ai-kit (keeps deployed)'})
  ),
  h(Section, {title: 'Global flags'},
    h(Row, {label: '--quiet | -q', value: 'Ẩn output info/ok (phù hợp CI)'}),
    h(Row, {label: '--yes | -y', value: 'Skip confirmation prompts (clean, uninstall)'})
  ),
  h(Box, {marginTop: 1},
    h(Text, {color: T.dim}, `Layout: ${AI_KIT_HOME}  ·  help <cmd> for details`)
  )
);

const Version = () => {
  ensureRepo();
  const sha = gitOut('describe', '--always', '--dirty');
  const date = gitOut('log', '-1', '--format=%cd', '--date=short');
  const msg = gitOut('log', '-1', '--format=%s');
  const envFile = path.join(REPO_DIR, 'mcp', 'etc-platform', '.env');
  let img = '<not set>';
  if (exists(envFile)) {
    const m = fs.readFileSync(envFile, 'utf8').match(/^ETC_PLATFORM_IMAGE=(.+)$/m);
    if (m) img = m[1].trim();
  }
  return h(Box, {flexDirection: 'column', padding: 1},
    h(Header, {title: `ai-kit ${VERSION}`}),
    h(Section, {title: 'Components'},
      h(Row, {label: 'ai-kit', value: VERSION, color: T.success}),
      h(Row, {label: 'team-config', value: sha, color: T.success}),
      h(Row, {label: '   date', value: date}),
      h(Row, {label: '   commit', value: msg}),
      h(Row, {label: 'MCP image', value: img, color: T.primary})
    )
  );
};

// buildStatusData: pure data fn — no blocking I/O in Ink render phase
const buildStatusData = () => {
  const sha = gitOut('rev-parse', '--short', 'HEAD');
  const date = gitOut('log', '-1', '--format=%cd', '--date=short');
  const msg = gitOut('log', '-1', '--format=%s');
  const countDir = (p, filter) => {
    if (!exists(p)) return 0;
    return fs.readdirSync(p, {withFileTypes: true}).filter(filter).length;
  };
  return {
    sha, date, msg,
    claudeAgents: countDir(path.join(os.homedir(), '.claude', 'agents'), e => e.isFile() && e.name.endsWith('.md')),
    claudeSkills: countDir(path.join(os.homedir(), '.claude', 'skills'), e => e.isDirectory()),
    cursorAgents: countDir(path.join(os.homedir(), '.cursor', 'agents'), e => e.isFile() && e.name.endsWith('.md')),
    cursorSkills: countDir(path.join(os.homedir(), '.cursor', 'skills'), e => e.isDirectory()),
  };
};

const Status = ({sha, date, msg, claudeAgents, claudeSkills, cursorAgents, cursorSkills}) => {
  const [mcpStatus, setMcpStatus] = useState({state: 'checking', healthz: 'checking'});
  const {exit} = useApp();

  useEffect(() => {
    (async () => {
      try {
        const {stdout} = await execa('docker', ['ps', '--format', '{{.Names}}|{{.Status}}'], {stdio: ['ignore', 'pipe', 'ignore']});
        const line = stdout.split('\n').find(l => l.startsWith('etc-platform|'));
        if (!line) { setMcpStatus({state: 'stopped', healthz: 'n/a'}); return; }
        const status = line.split('|')[1];
        try {
          const r = await fetch('http://localhost:8001/healthz', {signal: AbortSignal.timeout(2000)});
          setMcpStatus({state: status, healthz: r.ok ? 'OK' : `HTTP ${r.status}`});
        } catch {
          setMcpStatus({state: status, healthz: 'unreachable'});
        }
      } catch {
        setMcpStatus({state: 'docker error', healthz: 'n/a'});
      } finally {
        setTimeout(exit, 50);
      }
    })();
  }, []);

  return h(Box, {flexDirection: 'column', padding: 1},
    h(Header, {title: 'Team AI Config — Status', subtitle: `Repo: ${REPO_DIR}`}),
    h(Section, {title: 'Repository'},
      h(Row, {label: 'version', value: `${sha} (${date})`, color: T.success}),
      h(Row, {label: 'commit', value: msg})
    ),
    h(Section, {title: 'Deployed configs'},
      h(Row, {label: 'claude agents', value: String(claudeAgents), color: claudeAgents > 0 ? T.success : T.warn}),
      h(Row, {label: 'claude skills', value: String(claudeSkills), color: claudeSkills > 0 ? T.success : T.warn}),
      h(Row, {label: 'cursor agents', value: String(cursorAgents), color: cursorAgents > 0 ? T.success : T.warn}),
      h(Row, {label: 'cursor skills', value: String(cursorSkills), color: cursorSkills > 0 ? T.success : T.warn})
    ),
    h(Section, {title: 'MCP — etc-platform'},
      mcpStatus.state === 'checking'
        ? h(Box, null, h(Spinner, {type: 'dots'}), h(Text, null, ' Checking...'))
        : h(Box, {flexDirection: 'column'},
            h(Row, {label: 'state', value: mcpStatus.state, color: mcpStatus.state === 'stopped' ? T.danger : T.success}),
            h(Row, {label: 'healthz', value: mcpStatus.healthz, color: mcpStatus.healthz === 'OK' ? T.success : T.warn})
          )
    )
  );
};

// buildDoctorData: pure data fn — no I/O in Ink render phase
const buildDoctorData = () => {
  let nodeVersion = null;
  try { nodeVersion = execaSync('node', ['--version'], {stdio: ['ignore', 'pipe', 'ignore']}).stdout.trim(); } catch {}
  const nodeMajor = nodeVersion ? parseInt(nodeVersion.replace('v', '').split('.')[0], 10) : 0;
  // gh CLI auth check (important when team-ai-config repo is private)
  let ghAuth = null;
  if (cmdAvail('gh')) {
    try { execaSync('gh', ['auth', 'status'], {stdio: 'ignore'}); ghAuth = true; }
    catch { ghAuth = false; }
  }
  // MCP healthz check (HTTP probe, not just container state)
  let mcpHealthz = 'unknown';
  try {
    const res = execaSync('curl', ['-fsS', '--max-time', '2', 'http://localhost:8001/healthz'], {stdio: ['ignore', 'pipe', 'ignore']});
    mcpHealthz = res.exitCode === 0 ? 'OK' : 'fail';
  } catch { mcpHealthz = 'unreachable'; }
  // Disk free at AI_KIT_HOME
  let diskFreeGb = null;
  try {
    if (process.platform === 'win32') {
      const out = execaSync('powershell', ['-NoProfile', '-Command', `(Get-PSDrive ${AI_KIT_HOME[0]}).Free / 1GB`], {stdio: ['ignore', 'pipe', 'ignore']});
      diskFreeGb = parseFloat(out.stdout.trim());
    } else {
      const out = execaSync('df', ['-BG', AI_KIT_HOME], {stdio: ['ignore', 'pipe', 'ignore']});
      const m = out.stdout.split('\n')[1]?.match(/(\d+)G\s+\S+\s+\S+%/);
      if (m) diskFreeGb = parseInt(m[1], 10);
    }
  } catch {}

  const checks = [
    {name: 'git', required: true, ok: cmdAvail('git')},
    {name: 'docker', required: true, ok: cmdAvail('docker')},
    {name: `node ≥18 (found: ${nodeVersion || 'none'})`, required: true, ok: nodeMajor >= 18},
    {name: 'gh CLI (cho repo private)', required: false, ok: cmdAvail('gh'), extra: ghAuth === true ? 'authenticated' : ghAuth === false ? 'NOT authenticated — chạy `gh auth login`' : null},
    {name: `MCP /healthz (etc-platform)`, required: false, ok: mcpHealthz === 'OK', extra: `state: ${mcpHealthz}`},
    {name: `Disk free`, required: false, ok: diskFreeGb === null ? true : diskFreeGb >= 5, extra: diskFreeGb !== null ? `${diskFreeGb.toFixed(1)} GB free at ${AI_KIT_HOME}` : null},
    {name: 'curl', required: false, ok: cmdAvail('curl')},
    {name: 'glow (markdown render)', required: false, ok: cmdAvail('glow')},
    {name: 'bat (alt renderer)', required: false, ok: cmdAvail('bat')},
  ];
  let dockerDaemon = false;
  try { execaSync('docker', ['info'], {stdio: 'ignore'}); dockerDaemon = true; } catch {}
  const repoOk = exists(path.join(REPO_DIR, '.git'));
  const pathOk = (process.env.PATH || '').split(path.delimiter).includes(BIN_DIR);
  const allRequiredOk = checks.filter(c => c.required).every(c => c.ok) && dockerDaemon && repoOk;
  return {checks, dockerDaemon, repoOk, pathOk, allRequiredOk, nodeVersion};
};

const Doctor = ({checks, dockerDaemon, repoOk, pathOk, allRequiredOk}) =>
  h(Box, {flexDirection: 'column', padding: 1},
    h(Header, {title: 'ai-kit doctor', subtitle: 'Environment check'}),
    h(Section, {title: 'Required dependencies'},
      ...checks.filter(c => c.required).map(c =>
        c.ok ? h(Ok, null, c.name) : h(Err, null, `${c.name} — MISSING`)
      ),
      dockerDaemon ? h(Ok, null, 'docker daemon running') : h(Err, null, 'docker daemon NOT running'),
      repoOk ? h(Ok, null, 'team-ai-config cloned') : h(Err, null, 'team-ai-config NOT cloned')
    ),
    h(Section, {title: 'Optional checks'},
      ...checks.filter(c => !c.required).map(c => {
        const txt = c.extra ? `${c.name} — ${c.extra}` : c.name;
        return c.ok ? h(Ok, null, txt) : h(Warn, null, txt);
      })
    ),
    h(Section, {title: 'PATH'},
      pathOk
        ? h(Ok, null, `${BIN_DIR} in PATH`)
        : h(Warn, null, `${BIN_DIR} NOT in PATH (open new terminal)`)
    ),
    h(Box, {marginTop: 1},
      allRequiredOk
        ? h(Text, {color: T.success, bold: true}, '✓ All required checks passed')
        : h(Text, {color: T.danger, bold: true}, '✗ Some required checks failed')
    )
  );

const renderDoc = (file) => {
  const content = fs.readFileSync(file, 'utf8');
  const stripped = stripFm(content);
  // Skip glow if doc has ASCII art (box-drawing chars) — glow adds borders/colors
  // around individual characters, breaking diagram visuals
  const hasAsciiArt = /[┌┐└┘├┤┬┴┼]/.test(stripped);
  if (cmdAvail('glow') && !hasAsciiArt) {
    // Windows lacks 'less' for -p paging; let terminal handle scrolling natively
    const glowArgs = process.platform === 'win32' ? [file] : ['-p', file];
    try { execaSync('glow', glowArgs, {stdio: 'inherit'}); return; } catch {}
  }
  const w = _cols();
  const bar = '─'.repeat(w - 4);
  const relPath = path.relative(REPO_DIR, file);
  const out = process.stdout;
  out.write('\n');
  out.write(`  ${S.dim}${relPath}${S.reset}\n`);
  out.write(`  ${S.dim}${bar}${S.reset}\n\n`);
  out.write(marked.parse(stripped).trimEnd());
  out.write('\n\n');
  out.write(`  ${S.dim}${bar}${S.reset}\n`);
  out.write(`  ${S.gray}ai-kit doc  ·  ai-kit doc --search <term>${S.reset}\n\n`);
};


// ─── Plain-stdout doc renderers (no Ink — avoids ANSI-stripping + wrap bugs) ──

const S = {
  reset: _a('\x1b[0m'), bold: _a('\x1b[1m'), dim: _a('\x1b[2m'),
  cyan: _a('\x1b[36m'), bcyan: _a('\x1b[1;36m'),
  magenta: _a('\x1b[35m'), bmagenta: _a('\x1b[1;35m'),
  green: _a('\x1b[32m'), yellow: _a('\x1b[33m'), red: _a('\x1b[31m'),
  gray: _a('\x1b[90m'), white: _a('\x1b[97m'),
};

const printDivider = (title, count) => {
  const w = _cols();
  const label = count != null ? `${title} (${count})` : title;
  const lineLen = Math.max(2, w - label.length - 9);
  process.stdout.write(`\n${S.gray}  ── ${S.reset}${brand(label)} ${S.gray}${'─'.repeat(lineLen)}${S.reset}\n`);
};

const printItem = (name, title, nameWidth = 24) => {
  const n = name.padEnd(nameWidth);
  process.stdout.write(`  ${S.gray}›${S.reset} ${S.cyan}${n}${S.reset}  ${S.gray}${title || ''}${S.reset}\n`);
};

const readDocItems = (dir) => {
  if (!exists(dir)) return [];
  const items = fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    const tm = c.match(/^title:\s*(.+)$/m);
    const om = c.match(/^order:\s*(\d+)\s*$/m);
    return {
      name: f.replace(/\.md$/, ''),
      title: tm ? tm[1].replace(/^["']|["']$/g, '') : f,
      order: om ? parseInt(om[1], 10) : 999,
    };
  });
  // Sort by `order` (asc, lower first), then alphabetically by name
  items.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  return items;
};

const printDocsIndex = () => {
  ensureRepo();
  const docsDir = path.join(REPO_DIR, 'docs');
  const root = readDocItems(docsDir).filter(it => it.name !== 'README');
  const workflows = readDocItems(path.join(docsDir, 'workflows'));
  const reference = readDocItems(path.join(docsDir, 'reference'));
  const out = process.stdout;
  out.write(`\n${brand('  Documentation Hub')}\n`);
  out.write(`${S.gray}  ai-kit doc <topic>   ·   ai-kit doc --search <term>${S.reset}\n`);
  printDivider('General', root.length);
  root.forEach(it => printItem(it.name, it.title));
  printDivider('Workflows', workflows.length);
  workflows.forEach(it => printItem(it.name, it.title));
  printDivider('Reference', reference.length);
  reference.forEach(it => printItem(it.name, it.title));
  printDivider('Auto-indexes');
  printItem('skills', 'Claude + Cursor skills');
  printItem('agents', 'Claude + Cursor agents');
  out.write(`\n${S.gray}  Tip: ${S.reset}ai-kit doc --search <term>${S.gray} — full-text search across all docs + agents${S.reset}\n\n`);
};

const printSkillsIndex = () => {
  ensureRepo();
  const readSkills = (dir) => {
    if (!exists(dir)) return [];
    return fs.readdirSync(dir, {withFileTypes: true}).filter(e => e.isDirectory()).map(e => {
      const md = path.join(dir, e.name, 'SKILL.md');
      if (!exists(md)) return {name: e.name, title: '(no SKILL.md)'};
      const c = fs.readFileSync(md, 'utf8');
      const m = c.match(/^description:\s*(.+)$/m);
      return {name: e.name, title: cleanDesc(m ? m[1] : '')};
    });
  };
  const cs = readSkills(path.join(REPO_DIR, 'claude', 'skills'));
  const cu = readSkills(path.join(REPO_DIR, 'cursor', 'skills'));
  const out = process.stdout;
  out.write(`\n${brand('  Skills Catalog')}\n`);
  printDivider('Claude Skills  (~/.claude/skills/)', cs.length);
  cs.forEach(it => { out.write(`\n  ${S.bold}${S.cyan}/${it.name}${S.reset}\n    ${S.gray}${it.title}${S.reset}\n`); });
  printDivider('Cursor Skills  (~/.cursor/skills/)', cu.length);
  cu.forEach(it => { out.write(`\n  ${S.bold}${S.cyan}/${it.name}${S.reset}\n    ${S.gray}${it.title}${S.reset}\n`); });
  out.write('\n');
};

const printAgentsIndex = () => {
  ensureRepo();
  const readAgents = (dir) => {
    if (!exists(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.md') && !f.startsWith('ref-')).sort().map(f => {
      const c = fs.readFileSync(path.join(dir, f), 'utf8');
      const m = c.match(/^description:\s*(.+)$/m);
      return {name: f.replace(/\.md$/, ''), title: cleanDesc(m ? m[1] : '')};
    });
  };
  const cs = readAgents(path.join(REPO_DIR, 'claude', 'agents'));
  const cu = readAgents(path.join(REPO_DIR, 'cursor', 'agents'));
  const out = process.stdout;
  out.write(`\n${brand('  Agents Catalog')}\n`);
  printDivider('Claude Agents  (~/.claude/agents/)', cs.length);
  cs.forEach(it => { out.write(`\n  ${S.bold}${S.cyan}${it.name}${S.reset}\n    ${S.gray}${it.title}${S.reset}\n`); });
  printDivider('Cursor Agents  (~/.cursor/agents/)', cu.length);
  cu.forEach(it => { out.write(`\n  ${S.bold}${S.cyan}${it.name}${S.reset}\n    ${S.gray}${it.title}${S.reset}\n`); });
  out.write('\n');
};

// Render a static component then immediately unmount so Ink doesn't keep stdin open
const renderStaticLater = (el) => {
  const inst = render(el);
  setImmediate(() => inst.unmount());
};

// ─── Doc command dispatcher ────────────────────────────────────────────
const docCommand = (args) => {
  ensureRepo();
  const docsDir = path.join(REPO_DIR, 'docs');
  const sub = args[0];

  if (!sub || sub === 'index' || sub === '--toc' || sub === '-l' || sub === '--list') {
    printDocsIndex();
    return;
  }
  if (sub === '--search' || sub === '-s') {
    if (!args[1]) { console.error('Cách dùng: ai-kit doc --search <từ khoá>'); process.exit(1); }
    const term = args[1];
    const search = (root) => {
      if (!exists(root)) return [];
      const results = [];
      const walk = (d) => {
        for (const e of fs.readdirSync(d, {withFileTypes: true})) {
          const p = path.join(d, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.name.endsWith('.md')) {
            const lines = fs.readFileSync(p, 'utf8').split('\n');
            lines.forEach((line, i) => {
              if (line.toLowerCase().includes(term.toLowerCase())) {
                results.push({path: path.relative(REPO_DIR, p), line: i + 1, text: line.trim()});
              }
            });
          }
        }
      };
      walk(root);
      return results;
    };
    const results = [
      ...search(path.join(REPO_DIR, 'docs')),
      ...search(path.join(REPO_DIR, 'claude', 'agents')),
      ...search(path.join(REPO_DIR, 'cursor', 'agents')),
    ];
    const w = _cols();
    const bar = '─'.repeat(w - 4);
    const out = process.stdout;
    out.write(`\n  ${brand('Search results')}  ${S.gray}"${term}"  ·  ${results.length} hit${results.length !== 1 ? 's' : ''}${S.reset}\n`);
    out.write(`  ${S.dim}${bar}${S.reset}\n\n`);
    let lastFile = '';
    results.forEach(r => {
      if (r.path !== lastFile) {
        if (lastFile) out.write('\n');
        out.write(`  ${S.magenta}${r.path}${S.reset}\n`);
        lastFile = r.path;
      }
      out.write(`  ${S.gray}:${String(r.line).padStart(4)}${S.reset}  ${r.text}\n`);
    });
    out.write(`\n  ${S.dim}${bar}${S.reset}\n\n`);
    return;
  }
  if (sub === 'skills') { printSkillsIndex(); return; }
  if (sub === 'agents') { printAgentsIndex(); return; }

  // Resolve doc page
  const candidates = [
    path.join(docsDir, `${sub}.md`),
    path.join(docsDir, 'workflows', `${sub}.md`),
    path.join(docsDir, 'reference', `${sub}.md`),
  ];
  let file = candidates.find(exists);
  if (!file) {
    const all = [];
    const walk = (d) => {
      if (!exists(d)) return;
      for (const e of fs.readdirSync(d, {withFileTypes: true})) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.md') && e.name.toLowerCase().includes(sub.toLowerCase())) all.push(p);
      }
    };
    walk(docsDir);
    file = all[0];
  }
  if (!file) {
    process.stderr.write(`${S.red}  ✗ Topic not found: ${sub}${S.reset}\n`);
    printDocsIndex();
    process.exit(1);
  }
  renderDoc(file);
};

// ─── Imperative commands (side-effect heavy) ──────────────────────────
// Use plain console.log + chalk-style ANSI. No Ink overhead.

const C = S;  // unified ANSI constants — single source of truth
const info = m => { if (!QUIET) console.log(`${brand('▶')} ${m}`); };
const ok   = m => { if (!QUIET) console.log(`  ${C.green}✓${C.reset} ${m}`); };
const warn = m => console.log(`  ${C.yellow}⚠${C.reset} ${m}`);  // always show
const err  = m => console.error(`  ${C.red}✗${C.reset} ${m}`);   // always show

const sh = (cmd, args, opts = {}) => execaSync(cmd, args, {stdio: 'inherit', reject: false, ...opts});
const shQuiet = (cmd, args, opts = {}) => execaSync(cmd, args, {stdio: ['ignore', 'pipe', 'pipe'], reject: false, ...opts});

// ─── Background update-check (non-blocking) ────────────────────────────
// Reads last cached result (from previous background run) and displays notice.
// Spawns a detached Node process to refresh cache every 1h — does NOT block exit.
const bgUpdateCheck = () => {
  if (!exists(path.join(REPO_DIR, '.git'))) return;
  let cached = null;
  try { cached = JSON.parse(fs.readFileSync(UPDATE_CACHE, 'utf8')); } catch {}
  if (cached?.ahead > 0) {
    process.stdout.write(`\n  ${gradient('⬆ update available', [[255,200,0],[255,120,0]])}  ${_a('\x1b[90m')}${cached.ahead} commit(s) behind — ai-kit update${_a('\x1b[0m')}\n`);
  }
  const now = Date.now();
  if (cached?.ts && now - cached.ts < 3_600_000) return; // 1h TTL
  try {
    const tmp = path.join(os.tmpdir(), `ai-kit-upd-${process.pid}.mjs`);
    const R = JSON.stringify(REPO_DIR), C = JSON.stringify(UPDATE_CACHE), T = JSON.stringify(tmp);
    fs.writeFileSync(tmp,
      `import{execSync}from'node:child_process';import fs from'node:fs';\n` +
      `const R=${R},C=${C},T=${T};\n` +
      `try{\n` +
      `  execSync('git fetch origin --quiet',{cwd:R,timeout:5000,stdio:'ignore'});\n` +
      `  const n=parseInt(execSync('git rev-list --count HEAD..origin/HEAD',{cwd:R,timeout:2000,encoding:'utf8'}).trim())||0;\n` +
      `  fs.writeFileSync(C,JSON.stringify({ts:Date.now(),ahead:n}));\n` +
      `}catch{}try{fs.unlinkSync(T)}catch{}\n`
    );
    const child = spawn(process.execPath, [tmp], {detached: true, stdio: 'ignore', windowsHide: true});
    child.unref();
  } catch {}
};

const composeDir = () => path.join(REPO_DIR, 'mcp', 'etc-platform');
const composeCmd = (...args) => sh('docker', ['compose', ...args], {
  cwd: composeDir(),
  // quiet: suppress stdout only — keep stderr so docker errors remain visible
  ...(QUIET ? {stdio: ['ignore', 'ignore', 'inherit']} : {}),
});

// Returns 'ok' | 'not-installed' | 'not-running'.
// Probes `docker info` quietly — never throws.
const dockerHealth = () => {
  const which = shQuiet(process.platform === 'win32' ? 'where' : 'which', ['docker']);
  if (which.exitCode !== 0) return 'not-installed';
  const info = shQuiet('docker', ['info'], {timeout: 5000});
  if (info.exitCode !== 0) return 'not-running';
  return 'ok';
};

// Print friendly OS-specific guidance when Docker missing/stopped (boxed).
const printDockerGuide = (state) => {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const title = state === 'not-installed'
    ? '⚠ Docker chưa được cài đặt'
    : '⚠ Docker daemon đang dừng';
  let body;
  if (state === 'not-installed') {
    if (isWin) {
      body = `${C.cyan}Cài Docker Desktop cho Windows:${C.reset}\n`
        + `  1. Tải: https://www.docker.com/products/docker-desktop/\n`
        + `  2. Hoặc qua winget:  ${C.yellow}winget install Docker.DockerDesktop${C.reset}\n`
        + `  3. Sau khi cài, mở Docker Desktop và đợi icon xanh ở taskbar`;
    } else if (isMac) {
      body = `${C.cyan}Cài Docker Desktop cho macOS:${C.reset}\n`
        + `  1. Tải: https://www.docker.com/products/docker-desktop/\n`
        + `  2. Hoặc qua brew:  ${C.yellow}brew install --cask docker${C.reset}\n`
        + `  3. Sau khi cài, mở Docker Desktop từ Applications`;
    } else {
      body = `${C.cyan}Cài Docker Engine cho Linux:${C.reset}\n`
        + `  ${C.yellow}curl -fsSL https://get.docker.com | sh${C.reset}\n`
        + `  ${C.yellow}sudo usermod -aG docker $USER${C.reset}  ${C.gray}# logout/login để áp dụng${C.reset}\n`
        + `  ${C.yellow}sudo systemctl enable --now docker${C.reset}`;
    }
  } else {
    if (isWin) {
      body = `${C.cyan}Bật Docker Desktop:${C.reset}\n`
        + `  1. Mở Start menu → tìm "Docker Desktop" → Run\n`
        + `  2. Đợi icon Docker xanh ở taskbar (~30s)\n`
        + `  3. Hoặc CLI:  ${C.yellow}Start-Process "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"${C.reset}`;
    } else if (isMac) {
      body = `${C.cyan}Bật Docker Desktop:${C.reset}\n`
        + `  ${C.yellow}open -a Docker${C.reset}\n`
        + `  ${C.gray}# Đợi icon Docker xuất hiện trên menu bar (~30s)${C.reset}`;
    } else {
      body = `${C.cyan}Bật Docker daemon:${C.reset}\n`
        + `  ${C.yellow}sudo systemctl start docker${C.reset}\n`
        + `  ${C.yellow}sudo systemctl enable docker${C.reset}  ${C.gray}# tự động bật khi reboot${C.reset}`;
    }
  }
  body += `\n\n${C.gray}Sau khi xong, chạy lại:${C.reset}  ${C.green}ai-kit update${C.reset}`;
  console.log(boxen(body, {
    padding: 1, margin: {top: 0, bottom: 1, left: 2, right: 2},
    borderColor: 'yellow', borderStyle: 'round',
    title, titleAlignment: 'left',
  }));
};

// Try to auto-start Docker Desktop on Windows / macOS (best-effort, returns true if started).
const tryStartDocker = () => {
  if (process.platform === 'win32') {
    const exe = 'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe';
    if (!exists(exe)) return false;
    sh('powershell', ['-NoProfile', '-Command', `Start-Process -FilePath "${exe}"`]);
    return true;
  }
  if (process.platform === 'darwin') {
    sh('open', ['-a', 'Docker']);
    return true;
  }
  // Linux: try systemctl (may need sudo — best-effort silent attempt)
  const r = shQuiet('systemctl', ['start', 'docker']);
  return r.exitCode === 0;
};

// Wait for Docker daemon to be ready (poll docker info up to ~60s).
const waitForDocker = (maxMs = 60000) => {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const r = shQuiet('docker', ['info'], {timeout: 3000});
    if (r.exitCode === 0) return true;
    // sleep 2s
    const end = Date.now() + 2000;
    while (Date.now() < end) { /* busy-wait — small delay */ }
  }
  return false;
};

// ─── update ────────────────────────────────────────────────────────────
const cmdUpdate = async () => {
  ensureRepo();

  // Snapshot vars used across tasks
  let _snapName = '';

  const tasks = new Listr([
    {
      title: 'Kiểm tra thay đổi cục bộ',
      task: (ctx, task) => {
        const {stdout: dirty} = shQuiet('git', ['-C', REPO_DIR, 'status', '--porcelain']);
        if (dirty && dirty.trim()) {
          ctx.dirty = dirty;
          throw new Error('Có thay đổi cục bộ chưa commit — chạy "ai-kit reset" để bỏ, hoặc commit trước.');
        }
        task.title = 'Repo sạch, không có thay đổi cục bộ';
      },
    },
    {
      title: 'Pull team-ai-config mới nhất',
      task: (_, task) => {
        const r = sh('git', ['-C', REPO_DIR, 'pull', '--ff-only', '--quiet']);
        if (r.exitCode !== 0) throw new Error('git pull thất bại');
        task.title = 'Đã pull team-ai-config';
      },
    },
    {
      title: 'Làm mới ai-kit CLI tại ~/.ai-kit/bin',
      task: (_, task) => {
        fs.mkdirSync(BIN_DIR, {recursive: true});
        for (const f of ['ai-kit', 'ai-kit.cmd', 'ai-kit.ps1', 'ai-kit.mjs', 'ai-kit.legacy', 'ai-kit.legacy.ps1']) {
          const src = path.join(REPO_DIR, 'bin', f);
          const dst = path.join(BIN_DIR, f);
          if (exists(src)) {
            fs.copyFileSync(src, dst);
            if (process.platform !== 'win32' && (f === 'ai-kit' || f === 'ai-kit.legacy')) {
              try { fs.chmodSync(dst, 0o755); } catch {}
            }
          }
        }
        // Copy bin/lib/ recursively (modular ESM imports)
        const libSrc = path.join(REPO_DIR, 'bin', 'lib');
        const libDst = path.join(BIN_DIR, 'lib');
        if (exists(libSrc)) {
          fs.mkdirSync(libDst, {recursive: true});
          for (const e of fs.readdirSync(libSrc, {withFileTypes: true})) {
            if (e.isFile()) fs.copyFileSync(path.join(libSrc, e.name), path.join(libDst, e.name));
          }
        }
        task.title = 'Đã làm mới CLI';
      },
    },
    {
      title: 'Kiểm tra Node deps',
      enabled: () => exists(path.join(REPO_DIR, 'package.json')),
      task: (_, task) => {
        const pkgSrc = path.join(REPO_DIR, 'package.json');
        const hashFile = path.join(AI_KIT_HOME, '.deps-hash');
        const newHash = crypto.createHash('sha256').update(fs.readFileSync(pkgSrc)).digest('hex');
        const oldHash = exists(hashFile) ? fs.readFileSync(hashFile, 'utf8').trim() : '';
        const nodeModulesOk = exists(path.join(AI_KIT_HOME, 'node_modules'));
        if (newHash === oldHash && nodeModulesOk) {
          task.title = 'Node deps đã đồng bộ — bỏ qua npm install';
          task.skip();
          return;
        }
        task.title = 'Cài Node deps (package.json đã thay đổi)';
        fs.copyFileSync(pkgSrc, path.join(AI_KIT_HOME, 'package.json'));
        const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const r = sh(npmBin, ['install', '--omit=dev', '--silent'], {cwd: AI_KIT_HOME, stdio: ['ignore', 'ignore', 'pipe']});
        if (r.exitCode !== 0) throw new Error('npm install thất bại');
        fs.writeFileSync(hashFile, newHash);
        task.title = 'Đã cài Node deps';
      },
    },
    {
      title: 'Sao lưu cấu hình hiện tại',
      task: (ctx, task) => {
        const _snapTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        _snapName = `ai-config-backup-${_snapTs}`;
        const _cprSnap = (s, d) => {
          if (!exists(s)) return;
          fs.mkdirSync(d, {recursive: true});
          for (const e of fs.readdirSync(s, {withFileTypes: true})) {
            const sp = path.join(s, e.name), dp = path.join(d, e.name);
            if (e.isDirectory()) _cprSnap(sp, dp);
            else fs.copyFileSync(sp, dp);
          }
        };
        for (const [base, items] of [
          [path.join(os.homedir(), '.claude'), ['agents', 'skills']],
          [path.join(os.homedir(), '.cursor'), ['agents', 'skills']],
        ]) {
          for (const item of items) {
            const src = path.join(base, item);
            if (exists(src)) _cprSnap(src, path.join(base, _snapName, item));
          }
        }
        task.title = `Đã sao lưu (${_snapName})`;
      },
    },
    {
      title: 'Triển khai agents + skills vào ~/.claude và ~/.cursor',
      task: (_, task) => {
        const deploy = (subdir, target) => {
          const src = path.join(REPO_DIR, subdir);
          if (!exists(src)) return;
          const dst = path.join(os.homedir(), target);
          const dstTmp = dst + '.tmp';
          if (exists(dstTmp)) fs.rmSync(dstTmp, {recursive: true, force: true});
          if (cmdAvail('rsync')) {
            fs.mkdirSync(dstTmp, {recursive: true});
            sh('rsync', ['-a', '--delete', src + '/', dstTmp + '/']);
          } else {
            const cpr = (s, d) => {
              if (!exists(s)) return;
              fs.mkdirSync(d, {recursive: true});
              for (const e of fs.readdirSync(s, {withFileTypes: true})) {
                const sp = path.join(s, e.name), dp = path.join(d, e.name);
                if (e.isDirectory()) cpr(sp, dp);
                else fs.copyFileSync(sp, dp);
              }
            };
            cpr(src, dstTmp);
          }
          if (exists(dst)) fs.rmSync(dst, {recursive: true, force: true});
          fs.renameSync(dstTmp, dst);
        };
        deploy('claude/agents', '.claude/agents');
        deploy('claude/skills', '.claude/skills');
        deploy('cursor/agents', '.cursor/agents');
        deploy('cursor/skills', '.cursor/skills');
        task.title = 'Đã triển khai agents + skills';
      },
    },
    {
      title: 'Làm mới MCP image (Docker)',
      enabled: () => exists(composeDir()),
      task: async (ctx, task) => {
        let state = dockerHealth();
        if (state === 'not-running') {
          task.output = 'Docker daemon không phản hồi — đang thử khởi động tự động…';
          if (tryStartDocker() && waitForDocker(60000)) {
            state = 'ok';
          }
        }
        if (state !== 'ok') {
          ctx.dockerSkipped = state;
          task.skip(state === 'not-installed'
            ? 'Docker chưa cài — bỏ qua MCP refresh'
            : 'Docker đang dừng — bỏ qua MCP refresh');
          return;
        }
        task.output = 'Pulling image…';
        composeCmd('pull');
        task.output = 'Recreating container…';
        composeCmd('up', '-d', '--force-recreate');
        task.title = 'Đã làm mới MCP image';
      },
    },
  ], {
    rendererOptions: {collapseSubtasks: false, showSubtasks: true},
    exitOnError: true,
  });

  try {
    const ctx = await tasks.run();
    // Reset update-check cache so next invocation doesn't show stale "X behind"
    try {
      fs.mkdirSync(AI_KIT_HOME, {recursive: true});
      fs.writeFileSync(UPDATE_CACHE, JSON.stringify({ahead: 0, ts: Date.now()}));
    } catch {}

    // Auto-write integrity manifest after successful deploy
    try { writeManifest(); } catch {}

    if (ctx.dockerSkipped) {
      console.log('');
      printDockerGuide(ctx.dockerSkipped);
    } else {
      console.log('');
      console.log(boxen(
        `${C.green}✓ Cập nhật hoàn tất${C.reset}\n${C.gray}Repo + CLI + agents/skills + MCP image đã sẵn sàng${C.reset}`,
        {padding: 1, margin: {top: 0, bottom: 1, left: 2, right: 2},
         borderColor: 'green', borderStyle: 'round', title: 'ai-kit', titleAlignment: 'center'}
      ));
    }
  } catch (e) {
    console.log('');
    console.log(boxen(
      `${C.red}✗ Cập nhật thất bại${C.reset}\n${C.gray}${e.message || e}${C.reset}`,
      {padding: 1, margin: {top: 0, bottom: 1, left: 2, right: 2},
       borderColor: 'red', borderStyle: 'round', title: 'Lỗi', titleAlignment: 'center'}
    ));
    process.exit(1);
  }
};

// ─── mcp <verb> ────────────────────────────────────────────────────────
const cmdMcp = (args) => {
  ensureRepo();
  const verb = args[0] || 'status';
  if (!exists(composeDir())) { err(`MCP folder not found: ${composeDir()}`); process.exit(1); }
  // Pre-flight Docker check (skip for verbs that don't need daemon)
  if (!['help'].includes(verb)) {
    const state = dockerHealth();
    if (state !== 'ok') {
      printDockerGuide(state);
      process.exit(1);
    }
  }
  switch (verb) {
    case 'start':   info('docker compose up -d'); composeCmd('up', '-d'); break;
    case 'stop':    info('docker compose down'); composeCmd('down'); break;
    case 'restart': info('docker compose restart'); composeCmd('restart'); break;
    case 'logs':    composeCmd('logs', '-f', '--tail=200'); break;
    case 'pull':    info('docker compose pull'); composeCmd('pull'); break;
    case 'status':
      composeCmd('ps');
      if (!QUIET) {
        console.log(`\n  ${C.gray}API:  http://localhost:8001`);
        console.log(`  Docs: http://localhost:8001/docs${C.reset}`);
      }
      break;
    default:        err(`Unknown mcp verb: ${verb}. Use: start|stop|restart|logs|pull|status`); process.exit(1);
  }
};

// ─── logs ──────────────────────────────────────────────────────────────
const cmdLogs = () => cmdMcp(['logs']);

// ─── reset ─────────────────────────────────────────────────────────────
const cmdReset = (args) => {
  ensureRepo();
  const yes = args.includes('--yes') || args.includes('-y');
  // Check for local changes before showing confirmation
  let dirty = '';
  try { dirty = execaSync('git', ['-C', REPO_DIR, 'status', '--short'], {stdio: ['ignore', 'pipe', 'ignore']}).stdout.trim(); } catch {}
  if (!dirty) { ok('Repo đã sạch — không cần reset'); return; }
  if (!yes) {
    warn('Sẽ huỷ tất cả thay đổi cục bộ (git reset --hard + git clean -fd):');
    dirty.split('\n').forEach(l => console.log(`    ${C.gray}${l}${C.reset}`));
    warn('Chạy lại với --yes / -y để xác nhận: ai-kit reset --yes');
    process.exit(0);
  }
  info(`Resetting ${REPO_DIR} to clean HEAD`);
  sh('git', ['-C', REPO_DIR, 'reset', '--hard', 'HEAD']);
  sh('git', ['-C', REPO_DIR, 'clean', '-fd']);
  sh('git', ['-C', REPO_DIR, 'pull', '--ff-only', '--quiet']);
  ok('Đã reset + pull lại repo');
};

// ─── list-backups / rollback / clean ──────────────────────────────────
// Returns [{name, dirs}] grouped by snapshot timestamp (same name across .claude + .cursor)
const listBackupSnapshots = () => {
  const home = os.homedir();
  const map = new Map();
  for (const sub of ['.claude', '.cursor']) {
    const root = path.join(home, sub);
    if (!exists(root)) continue;
    for (const e of fs.readdirSync(root, {withFileTypes: true})) {
      if (e.isDirectory() && /^ai-config-backup-/.test(e.name)) {
        if (!map.has(e.name)) map.set(e.name, []);
        map.get(e.name).push(path.join(root, e.name));
      }
    }
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, dirs]) => ({name, dirs}));
};
const cmdListBackups = () => {
  const snaps = listBackupSnapshots();
  if (!snaps.length) { console.log('  (no backups)'); return; }
  snaps.forEach((s, i) => {
    console.log(`  [${i}]  ${s.name}  ${C.gray}(${s.dirs.length} location${s.dirs.length > 1 ? 's' : ''})${C.reset}`);
    s.dirs.forEach(d => console.log(`         ${C.gray}${d}${C.reset}`));
  });
  console.log(`\n  ${C.gray}Use: ai-kit rollback [N]  (newest = index ${snaps.length - 1})${C.reset}`);
};
const cmdRollback = (args) => {
  const n = args[0] ? parseInt(args[0], 10) : null;
  const snaps = listBackupSnapshots();
  if (!snaps.length) { err('Không tìm thấy bản sao lưu'); process.exit(1); }
  const snap = n != null ? snaps[n] : snaps[snaps.length - 1];
  if (!snap) { err(`No snapshot at index ${n}`); process.exit(1); }

  const cpr = (s, d) => {
    if (!exists(s)) return;
    fs.mkdirSync(d, {recursive: true});
    for (const e of fs.readdirSync(s, {withFileTypes: true})) {
      const sp = path.join(s, e.name), dp = path.join(d, e.name);
      if (e.isDirectory()) cpr(sp, dp);
      else fs.copyFileSync(sp, dp);
    }
  };

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const safetyName = `ai-config-backup-pre-rollback-${ts}`;

  // Restore each dir (both .claude and .cursor from same snapshot)
  for (const dir of snap.dirs) {
    const parentDir = path.dirname(dir);
    const safetyDir = path.join(parentDir, safetyName);
    // Safety: snapshot current live state before overwriting
    info(`Snapshotting ${path.basename(parentDir)} → ${safetyName}`);
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const live = path.join(parentDir, e.name);
      if (exists(live) && !/^ai-config-backup-/.test(e.name)) {
        cpr(live, path.join(safetyDir, e.name));
      }
    }
    info(`Restoring → ${parentDir}`);
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const sp = path.join(dir, e.name), dp = path.join(parentDir, e.name);
      if (e.isDirectory()) {
        if (exists(dp)) fs.rmSync(dp, {recursive: true, force: true});
        cpr(sp, dp);
      } else {
        fs.copyFileSync(sp, dp);
      }
    }
  }
  ok(`Restored snapshot: ${snap.name}`);
  ok(`Safety backup: ${safetyName}  (ai-kit rollback if needed)`);
};
const cmdClean = (args) => {
  const keepIdx = args.indexOf('--keep');
  const keep = keepIdx >= 0 ? parseInt(args[keepIdx + 1], 10) : 3;
  const yes = args.includes('--yes') || args.includes('-y');
  const snaps = listBackupSnapshots();
  const toDrop = snaps.length > keep ? snaps.slice(0, snaps.length - keep) : [];
  if (!toDrop.length) {
    ok(`Nothing to delete (have ${snaps.length} snapshot(s), keeping ${keep})`);
    return;
  }
  if (!yes) {
    warn(`Will delete ${toDrop.length} snapshot(s) + prune dangling Docker images.`);
    toDrop.forEach(s => {
      console.log(`    ${C.gray}${s.name}${C.reset}`);
      s.dirs.forEach(d => console.log(`      ${C.gray}${d}${C.reset}`));
    });
    warn('Chạy lại với --yes / -y để xác nhận.');
    process.exit(0);
  }
  toDrop.forEach(s => {
    info(`Removing ${s.name}`);
    s.dirs.forEach(d => fs.rmSync(d, {recursive: true, force: true}));
  });
  ok(`Deleted ${toDrop.length} snapshot(s)`);
  info('Đang dọn Docker image rời (chỉ etc-platform)');
  sh('docker', ['image', 'prune', '-f', '--filter', 'label=com.docker.compose.project=etc-platform']);
  ok('Dọn dẹp hoàn tất');
};

// ─── upgrade (npm update) ─────────────────────────────────────────────
const cmdUpgrade = () => {
  ensureRepo();
  info('Đang cập nhật Node deps tại ~/.ai-kit (npm update)');
  const pkgSrc = path.join(REPO_DIR, 'package.json');
  if (!exists(pkgSrc)) { err('package.json not found'); process.exit(1); }
  fs.copyFileSync(pkgSrc, path.join(AI_KIT_HOME, 'package.json'));
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = sh(npmBin, ['update', '--omit=dev', ...(QUIET ? ['--silent'] : [])], {cwd: AI_KIT_HOME});
  if (r.exitCode !== 0) { err('npm update failed'); process.exit(1); }
  ok('Đã nâng cấp deps');
};

// ─── pack / publish / diff / edit (maintainer) ────────────────────────
const cmdPack = () => {
  ensureRepo();
  info('Đang sao lưu ~/.claude + ~/.cursor → repo');
  const cpr = (s, d) => {
    if (!exists(s)) return;
    fs.mkdirSync(d, {recursive: true});
    for (const e of fs.readdirSync(s, {withFileTypes: true})) {
      const sp = path.join(s, e.name), dp = path.join(d, e.name);
      if (e.isDirectory()) cpr(sp, dp);
      else fs.copyFileSync(sp, dp);
    }
  };
  const copy = (src, dst) => {
    if (!exists(src)) return;
    if (cmdAvail('rsync')) sh('rsync', ['-a', '--delete', src + '/', dst + '/']);
    else {
      if (exists(dst)) fs.rmSync(dst, {recursive: true, force: true});
      cpr(src, dst);
    }
  };
  copy(path.join(os.homedir(), '.claude', 'agents'),  path.join(REPO_DIR, 'claude', 'agents'));
  copy(path.join(os.homedir(), '.claude', 'skills'),  path.join(REPO_DIR, 'claude', 'skills'));
  copy(path.join(os.homedir(), '.cursor', 'agents'),  path.join(REPO_DIR, 'cursor', 'agents'));
  copy(path.join(os.homedir(), '.cursor', 'skills'),  path.join(REPO_DIR, 'cursor', 'skills'));
  ok('Đã đóng gói');
  sh('git', ['-C', REPO_DIR, 'status', '--short']);
};
const cmdPublish = (args) => {
  ensureRepo();
  const msg = args.join(' ').trim();
  if (!msg) { err('Cách dùng: ai-kit publish "<commit message>"'); process.exit(1); }
  // Fast-fail: verify remote reachable before any side-effectful pack
  info('Đang kiểm tra kết nối git remote');
  const lsr = sh('git', ['-C', REPO_DIR, 'ls-remote', '--exit-code', 'origin', 'HEAD'], {stdio: ['ignore', 'ignore', 'inherit']});
  if (lsr.exitCode !== 0) { err('Không kết nối được git remote — kiểm tra credentials / mạng'); process.exit(1); }
  cmdPack();
  sh('git', ['-C', REPO_DIR, 'add', '-A']);
  const r = sh('git', ['-C', REPO_DIR, 'commit', '-m', msg]);
  if (r.exitCode !== 0) { warn('Không có gì để commit'); return; }
  sh('git', ['-C', REPO_DIR, 'push']);
  ok('Đã publish');
};
const cmdDiff = () => {
  ensureRepo();
  sh('git', ['-C', REPO_DIR, 'status']);
  sh('git', ['-C', REPO_DIR, 'diff', '--stat']);
};
const cmdEdit = () => {
  ensureRepo();
  const editor = process.env.EDITOR || (process.platform === 'win32' ? 'code' : 'vi');
  sh(editor, [REPO_DIR]);
};

// ─── uninstall ─────────────────────────────────────────────────────────
const cmdUninstall = (args) => {
  const yes = args.includes('--yes') || args.includes('-y');
  warn(`This removes ${AI_KIT_HOME} (CLI + repo). Deployed ~/.claude + ~/.cursor stay.`);
  if (!yes) {
    warn('Chạy lại với --yes / -y để xác nhận: ai-kit uninstall --yes');
    process.exit(0);
  }
  fs.rmSync(AI_KIT_HOME, {recursive: true, force: true});
  ok('Đã gỡ');
};

// ─── schedule: cross-platform recurring ai-kit update ────────────────
// Windows: schtasks /Create /TN AiKitUpdate /TR "ai-kit update --quiet" /SC WEEKLY
// Unix:    crontab entry
const cmdSchedule = (args) => {
  const verb = args[0];
  if (!verb || verb === 'show' || verb === 'list') {
    if (process.platform === 'win32') {
      try {
        const r = execaSync('schtasks', ['/Query', '/TN', 'AiKitUpdate', '/V', '/FO', 'LIST'], {stdio: ['ignore', 'pipe', 'ignore']});
        console.log(r.stdout || '(không có lịch nào)');
      } catch { info('Chưa có lịch ai-kit update.'); }
    } else {
      try {
        const r = execaSync('crontab', ['-l'], {stdio: ['ignore', 'pipe', 'ignore']});
        const matched = r.stdout.split('\n').filter(l => l.includes('ai-kit'));
        console.log(matched.length ? matched.join('\n') : '(không có lịch ai-kit nào trong crontab)');
      } catch { info('Crontab rỗng hoặc chưa cài cron.'); }
    }
    return;
  }
  if (verb === 'update') {
    const interval = args[1] || '--weekly';
    if (process.platform === 'win32') {
      const sc = interval === '--daily' ? 'DAILY' : interval === '--monthly' ? 'MONTHLY' : 'WEEKLY';
      const cmd = `"${process.execPath}" "${path.join(BIN_DIR, 'ai-kit.mjs')}" update --quiet`;
      try {
        execaSync('schtasks', ['/Create', '/TN', 'AiKitUpdate', '/TR', cmd, '/SC', sc, '/ST', '09:00', '/F'], {stdio: 'inherit'});
        ok(`Đã đặt lịch ai-kit update ${sc.toLowerCase()} lúc 09:00`);
      } catch (e) { err(`schtasks lỗi: ${e.message}`); process.exit(1); }
    } else {
      const cron = interval === '--daily' ? '0 9 * * *' : interval === '--monthly' ? '0 9 1 * *' : '0 9 * * 1';
      const line = `${cron} ${path.join(BIN_DIR, 'ai-kit')} update --quiet # ai-kit-managed`;
      try {
        let existing = '';
        try { existing = execaSync('crontab', ['-l'], {stdio: ['ignore', 'pipe', 'ignore']}).stdout; } catch {}
        const cleaned = existing.split('\n').filter(l => !l.includes('# ai-kit-managed')).join('\n');
        const newCron = (cleaned + '\n' + line + '\n').replace(/\n+/g, '\n');
        const tmpFile = path.join(os.tmpdir(), 'ai-kit-cron-' + Date.now());
        fs.writeFileSync(tmpFile, newCron);
        execaSync('crontab', [tmpFile], {stdio: 'inherit'});
        fs.unlinkSync(tmpFile);
        ok(`Đã đặt lịch crontab: ${cron}`);
      } catch (e) { err(`crontab lỗi: ${e.message}`); process.exit(1); }
    }
    return;
  }
  if (verb === 'remove' || verb === 'rm') {
    if (process.platform === 'win32') {
      try { execaSync('schtasks', ['/Delete', '/TN', 'AiKitUpdate', '/F'], {stdio: 'inherit'}); ok('Đã xoá lịch'); }
      catch (e) { err(`schtasks lỗi: ${e.message}`); }
    } else {
      try {
        const existing = execaSync('crontab', ['-l'], {stdio: ['ignore', 'pipe', 'ignore']}).stdout;
        const cleaned = existing.split('\n').filter(l => !l.includes('# ai-kit-managed')).join('\n');
        const tmpFile = path.join(os.tmpdir(), 'ai-kit-cron-' + Date.now());
        fs.writeFileSync(tmpFile, cleaned);
        execaSync('crontab', [tmpFile], {stdio: 'inherit'});
        fs.unlinkSync(tmpFile);
        ok('Đã xoá lịch ai-kit khỏi crontab');
      } catch (e) { err(`crontab lỗi: ${e.message}`); }
    }
    return;
  }
  err(`Verb không hợp lệ: ${verb}. Dùng: show | update [--daily|--weekly|--monthly] | remove`);
  process.exit(1);
};

// ─── verify: integrity check of deployed agents/skills ─────────────────
// Compute SHA256 manifest of ~/.claude + ~/.cursor; compare with .manifest.lock.
// Detects local tampering (manual edits, drift). Optional --restore re-runs deploy.
const MANIFEST_FILE = path.join(AI_KIT_HOME, '.manifest.lock');

const computeManifest = () => {
  const targets = [
    path.join(os.homedir(), '.claude', 'agents'),
    path.join(os.homedir(), '.claude', 'skills'),
    path.join(os.homedir(), '.cursor',  'agents'),
    path.join(os.homedir(), '.cursor',  'skills'),
  ];
  const manifest = {};
  const walk = (root, base = root) => {
    if (!exists(root)) return;
    for (const e of fs.readdirSync(root, {withFileTypes: true})) {
      const p = path.join(root, e.name);
      if (e.isDirectory()) walk(p, base);
      else if (e.isFile()) {
        const rel = path.relative(os.homedir(), p).replace(/\\/g, '/');
        manifest[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16);
      }
    }
  };
  for (const t of targets) walk(t);
  return manifest;
};

const writeManifest = () => {
  const m = computeManifest();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify({generated: new Date().toISOString(), files: m}, null, 2));
  return m;
};

const cmdVerify = (args) => {
  const restore = args.includes('--restore') || args.includes('-r');
  const update = args.includes('--update');

  if (update) {
    const m = writeManifest();
    ok(`Đã cập nhật manifest: ${Object.keys(m).length} files tracked`);
    return;
  }

  if (!exists(MANIFEST_FILE)) {
    warn('Chưa có manifest. Chạy "ai-kit verify --update" để tạo lần đầu (sau khi deploy).');
    process.exit(2);
  }

  const expected = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'));
  const actual = computeManifest();
  const drift = {modified: [], removed: [], added: []};
  for (const [f, h] of Object.entries(expected.files)) {
    if (!(f in actual)) drift.removed.push(f);
    else if (actual[f] !== h) drift.modified.push(f);
  }
  for (const f of Object.keys(actual)) {
    if (!(f in expected.files)) drift.added.push(f);
  }
  const total = drift.modified.length + drift.removed.length + drift.added.length;
  const out = process.stdout;
  const w = _cols(), divider = '─'.repeat(Math.min(w - 4, 70));
  out.write(`\n  ${brand('🔒 ai-kit verify')}\n  ${S.dim}${divider}${S.reset}\n`);
  out.write(`  ${S.gray}Manifest từ ${S.reset}${expected.generated}\n`);
  out.write(`  ${S.gray}Files tracked: ${S.reset}${S.bcyan}${Object.keys(expected.files).length}${S.reset}\n\n`);

  if (total === 0) {
    out.write(`  ${S.green}${S.bold}✓ Toàn vẹn${S.reset} ${S.gray}— không phát hiện thay đổi local${S.reset}\n\n`);
    return;
  }

  out.write(`  ${S.red}${S.bold}⚠ Phát hiện ${total} drift${S.reset}\n`);
  if (drift.modified.length) {
    out.write(`\n  ${S.yellow}Modified (${drift.modified.length}):${S.reset}\n`);
    drift.modified.slice(0, 20).forEach(f => out.write(`    ${S.yellow}~${S.reset} ${f}\n`));
    if (drift.modified.length > 20) out.write(`    ${S.gray}... và ${drift.modified.length - 20} files khác${S.reset}\n`);
  }
  if (drift.removed.length) {
    out.write(`\n  ${S.red}Removed (${drift.removed.length}):${S.reset}\n`);
    drift.removed.slice(0, 10).forEach(f => out.write(`    ${S.red}-${S.reset} ${f}\n`));
  }
  if (drift.added.length) {
    out.write(`\n  ${S.cyan}Added (${drift.added.length}):${S.reset}\n`);
    drift.added.slice(0, 10).forEach(f => out.write(`    ${S.cyan}+${S.reset} ${f}\n`));
  }

  if (restore) {
    out.write(`\n  ${S.gray}Đang restore từ team-ai-config...${S.reset}\n`);
    cmdUpdate();
    return;
  }
  out.write(`\n  ${S.gray}Khôi phục: ${S.reset}ai-kit verify --restore${S.gray}  (chạy update lại)${S.reset}\n`);
  out.write(`  ${S.gray}Chấp nhận drift hiện tại: ${S.reset}ai-kit verify --update${S.reset}\n\n`);
  process.exitCode = 1;
};

// ─── search: full-text across docs + agents + skills ─────────────────
const cmdSearch = (args) => {
  const term = args[0];
  if (!term || term.startsWith('-')) { err('Cách dùng: ai-kit search <từ khoá> [--scope all|docs|agents|skills]'); process.exit(1); }
  const scopeIdx = args.findIndex(a => a === '--scope');
  const scope = scopeIdx >= 0 ? args[scopeIdx+1] : 'all';

  ensureRepo();
  const roots = {
    docs:    [path.join(REPO_DIR, 'docs')],
    agents:  [path.join(os.homedir(), '.claude', 'agents'), path.join(os.homedir(), '.cursor', 'agents')],
    skills:  [path.join(os.homedir(), '.claude', 'skills'), path.join(os.homedir(), '.cursor', 'skills')],
  };
  const targets = scope === 'all' ? Object.keys(roots) : [scope].filter(s => roots[s]);
  if (!targets.length) { err(`Scope không hợp lệ: ${scope}. Dùng: all|docs|agents|skills`); process.exit(1); }

  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const hits = [];
  const walk = (dir, scopeName) => {
    if (!exists(dir)) return;
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, scopeName);
      else if (e.isFile() && /\.(md|mdx|json|yaml|yml)$/.test(e.name)) {
        try {
          const lines = fs.readFileSync(p, 'utf8').split('\n');
          lines.forEach((ln, i) => {
            if (re.test(ln)) hits.push({scope: scopeName, file: p, line: i+1, text: ln.trim().slice(0, 160)});
          });
        } catch {}
      }
    }
  };
  for (const s of targets) for (const r of roots[s]) walk(r, s);

  const w = _cols(), divider = '─'.repeat(Math.min(w - 4, 80));
  const out = process.stdout;
  out.write(`\n  ${brand(`🔍 search "${term}"`)}  ${S.gray}— ${hits.length} hits  ·  scope: ${scope}${S.reset}\n  ${S.dim}${divider}${S.reset}\n`);
  if (!hits.length) { out.write(`\n  ${S.gray}Không tìm thấy.${S.reset}\n\n`); return; }

  // Group by file
  const byFile = {};
  for (const h of hits) (byFile[h.file] ||= []).push(h);
  const sorted = Object.entries(byFile).sort((a,b) => b[1].length - a[1].length).slice(0, 30);
  for (const [file, hs] of sorted) {
    const rel = path.relative(os.homedir(), file).replace(/\\/g, '/');
    out.write(`\n  ${S.magenta}~/${rel}${S.reset} ${S.gray}(${hs[0].scope}, ${hs.length} hits)${S.reset}\n`);
    hs.slice(0, 5).forEach(h => out.write(`  ${S.gray}:${String(h.line).padStart(4)}${S.reset}  ${h.text}\n`));
    if (hs.length > 5) out.write(`  ${S.dim}... +${hs.length - 5} dòng nữa${S.reset}\n`);
  }
  out.write(`\n  ${S.dim}${divider}${S.reset}\n  ${S.gray}--scope all|docs|agents|skills${S.reset}\n\n`);
};

// ─── config: get/set/list user prefs ───────────────────────────────────
// Manages ~/.ai-kit/{billing,alerts}.json + future toggles.
const CONFIG_FILES = {
  billing: path.join(AI_KIT_HOME, 'billing.json'),
  alerts:  path.join(AI_KIT_HOME, 'alerts.json'),
};
const cmdConfig = (args) => {
  const verb = args[0];
  if (!verb || verb === 'list' || verb === 'ls') {
    const out = process.stdout;
    out.write(`\n  ${brand('⚙ ai-kit config')}\n`);
    for (const [k, f] of Object.entries(CONFIG_FILES)) {
      const exists_ = exists(f);
      out.write(`\n  ${S.bold}${k}${S.reset} ${S.gray}(${f})${S.reset}\n`);
      if (exists_) {
        try {
          const data = JSON.parse(fs.readFileSync(f, 'utf8'));
          for (const [kk, vv] of Object.entries(data)) {
            out.write(`    ${S.cyan}${kk.padEnd(22)}${S.reset} ${S.gray}=${S.reset} ${JSON.stringify(vv)}\n`);
          }
        } catch { out.write(`    ${S.red}(invalid JSON)${S.reset}\n`); }
      } else out.write(`    ${S.dim}(chưa cấu hình — dùng default)${S.reset}\n`);
    }
    out.write(`\n  ${S.gray}Cách dùng: ${S.reset}ai-kit config set <file>.<key> <value>\n`);
    out.write(`  ${S.gray}           ${S.reset}ai-kit config get <file>.<key>\n\n`);
    return;
  }
  if (verb === 'get' || verb === 'set') {
    const dotKey = args[1];
    if (!dotKey || !dotKey.includes('.')) { err('Format: <file>.<key>  (file ∈ billing|alerts)'); process.exit(1); }
    const [file, key] = dotKey.split('.');
    if (!CONFIG_FILES[file]) { err(`File không hợp lệ: ${file}. Dùng: ${Object.keys(CONFIG_FILES).join('|')}`); process.exit(1); }
    const f = CONFIG_FILES[file];
    let data = exists(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
    if (verb === 'get') {
      console.log(JSON.stringify(data[key]));
      return;
    }
    let val = args[2];
    if (val === undefined) { err('Thiếu giá trị: ai-kit config set <file>.<key> <value>'); process.exit(1); }
    // Try parse as JSON (number/bool/string); fallback to raw string
    try { val = JSON.parse(val); } catch { /* keep as string */ }
    data[key] = val;
    fs.mkdirSync(AI_KIT_HOME, {recursive: true});
    fs.writeFileSync(f, JSON.stringify(data, null, 2));
    ok(`Đã set ${file}.${key} = ${JSON.stringify(val)}`);
    return;
  }
  err(`Verb không hợp lệ: ${verb}. Dùng: list | get | set`);
  process.exit(1);
};

// ─── install (alias for bootstrap message) ────────────────────────────
const cmdInstall = () => {
  info('Cài lần đầu: dùng bootstrap one-liner.');
  console.log('  macOS/Linux: curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash');
  console.log('  Windows:     irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex');
};

// ─── statistics ────────────────────────────────────────────────────────
// Local-only telemetry: parse ~/.claude/projects/*.jsonl + ~/.ai-kit/history.
// No network, no transmission. Every byte stays on the member machine.

// Pricing, parseSince, fmt* now imported from ./lib/util.mjs (testable)

// Threshold colorers
const colorCost = (n) => {
  const s = fmtUsd(n);
  if (n >= 100) return `${S.red}${S.bold}${s}${S.reset}`;
  if (n >= 10)  return `${S.red}${s}${S.reset}`;
  if (n >= 1)   return `${S.yellow}${s}${S.reset}`;
  if (n > 0)    return `${S.green}${s}${S.reset}`;
  return `${S.gray}${s}${S.reset}`;
};
const colorTokens = (n) => {
  const s = fmtN(n);
  if (n >= 1e9) return `${S.magenta}${S.bold}${s}${S.reset}`;
  if (n >= 1e8) return `${S.magenta}${s}${S.reset}`;
  if (n >= 1e6) return `${S.cyan}${s}${S.reset}`;
  return `${S.gray}${s}${S.reset}`;
};
const colorCount = (n, hi=50, mid=10) => {
  const s = fmtInt(n);
  if (n >= hi)  return `${S.bcyan}${s}${S.reset}`;
  if (n >= mid) return `${S.cyan}${s}${S.reset}`;
  return `${S.gray}${s}${S.reset}`;
};
const colorRate = (pct) => {
  const s = pct.toFixed(1) + '%';
  if (pct >= 10) return `${S.red}${s}${S.reset}`;
  if (pct >= 3)  return `${S.yellow}${s}${S.reset}`;
  return `${S.green}${s}${S.reset}`;
};

// vlen / padR / padL / bar / sparkline imported from ./lib/util.mjs

// Classify a tool error → {category, isReal, normalizedMessage}
// Categories:
//   workflow   — Claude Code's own validation errors (Edit before Read, etc.) — MY workflow bugs
//   shell_real — actual shell/command failures (exit ≥ 2, or exit 1 with real failure msg)
//   shell_noise — expected non-zero (grep no-match, git diff --quiet, test) — NOT actual errors
//   http       — network/HTTP errors (404, 5xx)
//   other      — uncategorized
// classifyError moved to ./lib/util.mjs (testable)

const collectStats = (sinceMs) => {
  const projectsRoot = path.join(os.homedir(), '.claude', 'projects');
  const S = {
    sessions: new Set(), days: new Set(),
    totalTokens: 0, totalCost: 0, requests: 0,
    byModel: {}, byTool: {}, byAgent: {}, bySkill: {}, byProject: {},
    byDay: {},
    bySubagentFile: {},
    errors: 0,
    parsedFiles: 0,
    // New dimensions
    cacheReadTokens: 0, cacheCreationTokens: 0, inputTokens: 0, outputTokens: 0,
    requestTokens: [],
    byHour: new Array(24).fill(0),
    byWeekday: new Array(7).fill(0),
    toolErrors: {},
    errorMessages: {},
    errorCategories: {workflow: 0, shell_real: 0, shell_noise: 0, http: 0, other: 0},
    realErrors: 0,
    linesAdded: 0, linesRemoved: 0,
    // ── Tuning indicators (Wave 5) ──────────────────────────────────
    // 1. Skill token attribution: tokens consumed AFTER skill activation
    skillStats: {},               // skill_name -> {invocations, tokens, cost, durations: [ms]}
    // 2. Agent durations (ms): time from first to last assistant msg in subagent file
    agentDurations: {},           // agent_name -> [ms, ms, ...]
    // 3. Prompt version hash — top hashes per agent/skill
    promptVersions: {},           // agent/skill name -> {hash: count}
    // 4. Tool n-gram: pair (prev, curr) within session
    toolNgrams: {},               // 'prev→curr' -> count
    // 5. Per-session efficiency
    sessionStats: {},             // session_id -> {turns, tokens, cost, edits, firstEditTs, lastTs, firstTs, errored, project}
  };
  if (!exists(projectsRoot)) return S;

  const walk = (dir) => {
    let entries; try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.jsonl')) {
        // Skip file when its last-modified time is older than sinceMs (perf optimization)
        try {
          const st = fs.statSync(p);
          if (st.mtimeMs < sinceMs) { S.parsedFiles++; continue; }
        } catch {}
        parseFile(p);
      }
    }
  };

  // Prompt version hash cache (agent/skill .md → 8-char hash)
  const promptHashCache = {};
  const hashPromptFile = (name, kind /* 'agent' | 'skill' */) => {
    if (promptHashCache[`${kind}:${name}`] !== undefined) return promptHashCache[`${kind}:${name}`];
    const candidates = kind === 'agent'
      ? [path.join(os.homedir(), '.claude', 'agents', `${name}.md`),
         path.join(os.homedir(), '.cursor', 'agents', `${name}.md`)]
      : [path.join(os.homedir(), '.claude', 'skills', name, 'SKILL.md'),
         path.join(os.homedir(), '.cursor', 'skills', name, 'SKILL.md')];
    let hash = null;
    for (const p of candidates) {
      if (exists(p)) {
        hash = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
        break;
      }
    }
    promptHashCache[`${kind}:${name}`] = hash;
    return hash;
  };

  // Correlation maps for token attribution to subagents.
  // Chain: Agent tool_use (assistant) → tool_result (user, has promptId) → subagent file (has same promptId).
  const agentToolIds = {};       // toolu_xxx -> subagent_type
  const promptIdToAgent = {};    // promptId  -> subagent_type
  const subagentFileTokens = {}; // file      -> {tokens, cost, promptIds: Set}
  const toolUseIdToName = {};    // toolu_xxx -> tool name (for error attribution)
  const toolUseIdToCmd = {};     // toolu_xxx -> command string (for noise detection)

  const parseFile = (file) => {
    let data; try { data = fs.readFileSync(file, 'utf8'); } catch { return; }
    S.parsedFiles++;
    const isSubagent = file.includes(`${path.sep}subagents${path.sep}`);
    let fileTokens = 0, fileCost = 0;
    const filePromptIds = new Set();
    // ── Wave 5 state ───────────────────────────────────────────────
    let activeSkill = null;        // name of currently-running skill (window for token attribution)
    let activeSkillTs = null;      // start ts for duration
    let prevToolName = null;       // for n-gram pairing
    let firstAssistantTs = null;   // for subagent file → agent duration
    let lastAssistantTs = null;

    for (const line of data.split('\n')) {
      if (!line) continue;
      let obj; try { obj = JSON.parse(line); } catch { continue; }
      const ts = obj.timestamp ? Date.parse(obj.timestamp) : 0;
      if (ts && ts < sinceMs) continue;

      if (obj.sessionId) S.sessions.add(obj.sessionId);
      if (ts) S.days.add(new Date(ts).toISOString().slice(0,10));
      if (obj.cwd && !isSubagent) {
        const proj = path.basename(obj.cwd);
        S.byProject[proj] = (S.byProject[proj]||0) + 1;
      }
      if (isSubagent && obj.promptId) filePromptIds.add(obj.promptId);

      const msg = obj.message;
      if (!msg) continue;

      // Assistant message: usage + tool_use blocks
      if (msg.role === 'assistant' && msg.usage) {
        const model = msg.model || 'unknown';
        const u = msg.usage;
        const inT = u.input_tokens||0, outT = u.output_tokens||0;
        const crT = u.cache_read_input_tokens||0, cwT = u.cache_creation_input_tokens||0;
        const tok = inT + outT + crT + cwT;
        const cost = costOf(model, u);
        S.totalTokens += tok; S.totalCost += cost; S.requests++;
        S.inputTokens += inT; S.outputTokens += outT;
        S.cacheReadTokens += crT; S.cacheCreationTokens += cwT;
        S.requestTokens.push(tok);
        fileTokens += tok; fileCost += cost;
        const mb = S.byModel[model] ||= {tokens:0, cost:0, requests:0};
        mb.tokens += tok; mb.cost += cost; mb.requests++;
        if (ts) {
          const d = new Date(ts);
          const day = d.toISOString().slice(0, 10);
          const db = S.byDay[day] ||= {tokens:0, cost:0, requests:0};
          db.tokens += tok; db.cost += cost; db.requests++;
          S.byHour[d.getHours()]++;
          S.byWeekday[d.getDay()]++;
          if (!firstAssistantTs) firstAssistantTs = ts;
          lastAssistantTs = ts;
        }
        // Per-session aggregation (only main sessions, not subagent files)
        if (!isSubagent && obj.sessionId) {
          const ss = S.sessionStats[obj.sessionId] ||= {
            turns: 0, tokens: 0, cost: 0, edits: 0,
            firstEditTs: null, firstTs: ts || null, lastTs: ts || null,
            errored: false, project: obj.cwd ? path.basename(obj.cwd) : 'unknown',
          };
          ss.turns++;
          ss.tokens += tok;
          ss.cost += cost;
          if (ts && ts < (ss.firstTs || Infinity)) ss.firstTs = ts;
          if (ts && ts > (ss.lastTs || 0)) ss.lastTs = ts;
        }
        // Skill token attribution: tokens of THIS assistant turn count toward the active skill
        if (activeSkill && !isSubagent) {
          const ss = S.skillStats[activeSkill];
          if (ss) { ss.tokens += tok; ss.cost += cost; }
        }

        if (Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (c.type !== 'tool_use') continue;
            const tn = c.name;
            S.byTool[tn] = (S.byTool[tn]||0) + 1;
            if (c.id) {
              toolUseIdToName[c.id] = tn;
              if ((tn === 'Bash' || tn === 'PowerShell') && c.input?.command) {
                toolUseIdToCmd[c.id] = String(c.input.command).slice(0, 500);
              }
            }
            // n-gram: pair previous tool with current
            if (prevToolName) {
              const key = `${prevToolName} → ${tn}`;
              S.toolNgrams[key] = (S.toolNgrams[key]||0) + 1;
            }
            prevToolName = tn;

            if (tn === 'Agent' && c.input?.subagent_type) {
              const at = c.input.subagent_type;
              const ab = S.byAgent[at] ||= {tokens:0, cost:0, dispatches:0};
              ab.dispatches++;
              if (c.id) agentToolIds[c.id] = at;
              // Track prompt version
              const h = hashPromptFile(at, 'agent');
              if (h) {
                const pv = S.promptVersions[`agent:${at}`] ||= {};
                pv[h] = (pv[h]||0) + 1;
              }
            }
            if (tn === 'Skill' && c.input?.skill) {
              const sk = c.input.skill;
              const sb = S.bySkill[sk] ||= {invocations:0};
              sb.invocations++;
              // Init skill stats + activate window
              const ss = S.skillStats[sk] ||= {invocations:0, tokens:0, cost:0, durations:[]};
              ss.invocations++;
              if (activeSkill && activeSkillTs && ts) {
                // Close previous window
                const prev = S.skillStats[activeSkill];
                if (prev) prev.durations.push(ts - activeSkillTs);
              }
              activeSkill = sk;
              activeSkillTs = ts;
              // Prompt version
              const h = hashPromptFile(sk, 'skill');
              if (h) {
                const pv = S.promptVersions[`skill:${sk}`] ||= {};
                pv[h] = (pv[h]||0) + 1;
              }
            }
            // Track edits per session
            if (!isSubagent && obj.sessionId && (tn === 'Edit' || tn === 'Write')) {
              const ss = S.sessionStats[obj.sessionId];
              if (ss) {
                ss.edits++;
                if (!ss.firstEditTs && ts) ss.firstEditTs = ts;
              }
            }
            // LoC heuristic for Edit/Write
            if (tn === 'Edit' && typeof c.input?.new_string === 'string') {
              const oldL = (c.input.old_string || '').split('\n').length;
              const newL = c.input.new_string.split('\n').length;
              if (newL > oldL) S.linesAdded += (newL - oldL);
              else S.linesRemoved += (oldL - newL);
            }
            if (tn === 'Write' && typeof c.input?.content === 'string') {
              S.linesAdded += c.input.content.split('\n').length;
            }
          }
        }
      }
      // Real user message (text content, not tool_result) → close skill window
      if (msg.role === 'user' && typeof msg.content === 'string') {
        if (activeSkill && activeSkillTs && ts) {
          const prev = S.skillStats[activeSkill];
          if (prev) prev.durations.push(ts - activeSkillTs);
        }
        activeSkill = null; activeSkillTs = null;
        prevToolName = null;  // reset n-gram chain across user turns
      }
      // tool_result lines: error tracking + agent attribution
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        for (const c of msg.content) {
          if (c.type !== 'tool_result') continue;
          if (c.is_error) {
            S.errors++;
            const tuid = c.tool_use_id;
            const toolName = toolUseIdToName[tuid] || 'unknown';
            const txt = Array.isArray(c.content) ? (c.content.find(x => x.type === 'text')?.text || '') : (typeof c.content === 'string' ? c.content : '');
            const cmd = toolUseIdToCmd[tuid] || '';
            const cls = classifyError(toolName, txt, cmd);
            S.errorCategories[cls.category]++;
            if (cls.isReal) {
              S.realErrors++;
              S.toolErrors[toolName] = (S.toolErrors[toolName]||0) + 1;
              const key = `[${cls.category}] ${cls.msg}`;
              if (cls.msg) S.errorMessages[key] = (S.errorMessages[key]||0) + 1;
              if (!isSubagent && obj.sessionId) {
                const ss = S.sessionStats[obj.sessionId];
                if (ss) ss.errored = true;
              }
            }
          }
          if (obj.promptId) {
            const tuid = c.tool_use_id;
            if (tuid && agentToolIds[tuid]) promptIdToAgent[obj.promptId] = agentToolIds[tuid];
          }
        }
      }
    }
    if (isSubagent) {
      subagentFileTokens[file] = {
        tokens: fileTokens, cost: fileCost, promptIds: filePromptIds,
        duration: (firstAssistantTs && lastAssistantTs) ? (lastAssistantTs - firstAssistantTs) : 0,
      };
    }
  };

  walk(projectsRoot);

  // Pass 2: credit subagent file tokens to subagent_type via promptId match.
  for (const t of Object.values(subagentFileTokens)) {
    let agentType = null;
    for (const pid of t.promptIds) if (promptIdToAgent[pid]) { agentType = promptIdToAgent[pid]; break; }
    if (agentType) {
      const ab = S.byAgent[agentType] ||= {tokens:0, cost:0, dispatches:0};
      ab.tokens += t.tokens; ab.cost += t.cost;
      if (t.duration > 0) (S.agentDurations[agentType] ||= []).push(t.duration);
    }
  }
  return S;
};

const collectCliHistory = (sinceMs) => {
  const out = {commands: {}, total: 0};
  if (!exists(HISTORY_FILE)) return out;
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
  for (const l of lines) {
    const {ts, cmd} = parseHistLine(l);
    if (ts && ts < sinceMs) continue;  // filter by --since when timestamp present
    const verb = cmd.split(/\s+/)[0];
    if (!verb) continue;
    out.commands[verb] = (out.commands[verb]||0) + 1;
    out.total++;
  }
  return out;
};

const printTable = (title, rows, columns) => {
  if (!rows.length) return;
  // Compute widths from visible (stripped) length
  const widths = columns.map((c, i) =>
    Math.max(vlen(c.label), ...rows.map(r => vlen(r[i] ?? '')))
  );
  const pad = (cell, i) => columns[i].align === 'r' ? padL(String(cell), widths[i]) : padR(String(cell), widths[i]);
  const sep = (l, m, r) => `  ${S.dim}${l}${widths.map(w => '─'.repeat(w + 2)).join(m)}${r}${S.reset}\n`;

  process.stdout.write(`\n  ${S.bold}${title}${S.reset}\n`);
  process.stdout.write(sep('┌', '┬', '┐'));
  process.stdout.write(`  ${S.dim}│${S.reset} ` +
    columns.map((c, i) => `${S.bold}${padR(c.label, widths[i])}${S.reset}`).join(` ${S.dim}│${S.reset} `) +
    ` ${S.dim}│${S.reset}\n`);
  process.stdout.write(sep('├', '┼', '┤'));
  for (const r of rows) {
    process.stdout.write(`  ${S.dim}│${S.reset} ` +
      r.map((v, i) => pad(v ?? '', i)).join(` ${S.dim}│${S.reset} `) +
      ` ${S.dim}│${S.reset}\n`);
  }
  process.stdout.write(sep('└', '┴', '┘'));
};

// Build daily series for last N days (zero-fill missing days)
const dailySeries = (byDay, sinceMs) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(sinceMs); start.setHours(0,0,0,0);
  const days = Math.max(1, Math.ceil((today - start) / 86400_000) + 1);
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400_000);
    const k = d.toISOString().slice(0, 10);
    const v = byDay[k] || {tokens:0, cost:0, requests:0};
    series.push({date: k, ...v});
  }
  return series;
};

// Default alert thresholds (can be overridden via ~/.ai-kit/alerts.json)
// Cost numbers below are API list-price equivalent (USD), NOT actual billing.
// Members on Team/Pro flat-rate plans do not pay these amounts.
const DEFAULT_ALERTS = {
  total_cost_warn: 500,       // API-equivalent USD over window
  total_cost_crit: 2000,
  daily_spike_factor: 2.5,
  agent_cost_warn: 100,
  error_rate_warn: 5,
};

// Plan info (set via ~/.ai-kit/billing.json: {"plan": "team", "monthly_usd": 100})
const loadPlan = () => {
  const f = path.join(AI_KIT_HOME, 'billing.json');
  if (!exists(f)) return {plan: 'team', monthly_usd: 100};
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {plan: 'team', monthly_usd: 100}; }
};
const loadAlerts = () => {
  const f = path.join(AI_KIT_HOME, 'alerts.json');
  if (!exists(f)) return DEFAULT_ALERTS;
  try { return {...DEFAULT_ALERTS, ...JSON.parse(fs.readFileSync(f, 'utf8'))}; }
  catch { return DEFAULT_ALERTS; }
};

const computeAlerts = (stats, series, thresholds) => {
  const alerts = [];
  if (stats.totalCost >= thresholds.total_cost_crit) {
    alerts.push({level: 'crit', msg: `Tổng chi phí ${fmtUsd(stats.totalCost)} ≥ ngưỡng nghiêm trọng ${fmtUsd(thresholds.total_cost_crit)}`});
  } else if (stats.totalCost >= thresholds.total_cost_warn) {
    alerts.push({level: 'warn', msg: `Tổng chi phí ${fmtUsd(stats.totalCost)} ≥ ngưỡng cảnh báo ${fmtUsd(thresholds.total_cost_warn)}`});
  }
  // Daily spike: find days where cost > median × factor
  const costs = series.map(s => s.cost).filter(c => c > 0).sort((a,b) => a - b);
  if (costs.length >= 3) {
    const median = costs[Math.floor(costs.length / 2)];
    const spikes = series.filter(s => s.cost > median * thresholds.daily_spike_factor && s.cost > 1);
    for (const s of spikes) {
      alerts.push({level: 'warn', msg: `Tăng đột biến ngày ${s.date}: ${fmtUsd(s.cost)} (${(s.cost/median).toFixed(1)}× median ${fmtUsd(median)})`});
    }
  }
  // Single-agent cost
  for (const [name, v] of Object.entries(stats.byAgent)) {
    if (v.cost >= thresholds.agent_cost_warn) {
      alerts.push({level: 'warn', msg: `Agent "${name}" tốn ${fmtUsd(v.cost)} ≥ ngưỡng ${fmtUsd(thresholds.agent_cost_warn)}`});
    }
  }
  // Error rate (use REAL errors, exclude shell_noise)
  const errRate = stats.requests ? (stats.realErrors / stats.requests) * 100 : 0;
  if (errRate >= thresholds.error_rate_warn) {
    alerts.push({level: 'warn', msg: `Tool error rate ${errRate.toFixed(1)}% ≥ ngưỡng ${thresholds.error_rate_warn}% (${stats.realErrors} lỗi thật/${stats.requests} requests)`});
  }
  return alerts;
};

const cmdStatistics = (args) => {
  const sinceArg = (() => {
    const i = args.findIndex(a => a === '--since');
    return i >= 0 ? args[i+1] : null;
  })();
  const sinceMs = parseSince(sinceArg || '30d');
  const top = (() => {
    const i = args.findIndex(a => a === '--top');
    return i >= 0 ? Math.max(1, parseInt(args[i+1], 10) || 10) : 10;
  })();
  const json = args.includes('--json');

  const stats = collectStats(sinceMs);
  const cli = collectCliHistory(sinceMs);

  // --html: standalone HTML report (offline-shareable)
  if (args.includes('--html')) {
    const sinceLabel = sinceArg || '30d';
    const idx = args.indexOf('--html');
    const outFile = args[idx+1] && !args[idx+1].startsWith('-') ? args[idx+1] : `ai-kit-statistics-${new Date().toISOString().slice(0,10)}.html`;
    const sortedTok = [...stats.requestTokens].sort((a,b) => a - b);
    const totalIn = stats.inputTokens + stats.cacheReadTokens + stats.cacheCreationTokens;
    const cacheHitRate = totalIn > 0 ? (stats.cacheReadTokens / totalIn) * 100 : 0;
    const series = dailySeries(stats.byDay, sinceMs);
    const wkLabels = ['CN','T2','T3','T4','T5','T6','T7'];
    const sortObj = (o, k = (v) => v) => Object.entries(o).sort((a,b) => k(b[1]) - k(a[1]));
    const tableRows = (entries, mapFn) => entries.map(mapFn).join('');
    const html = `<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8"><title>ai-kit statistics — ${sinceLabel}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; max-width: 1100px; margin: 2em auto; padding: 0 1em; color: #1a1a1a; background: #fafafa; }
  h1 { background: linear-gradient(90deg, #00e5ff, #2979ff, #aa00ff); -webkit-background-clip: text; background-clip: text; color: transparent; font-size: 2em; }
  h2 { border-bottom: 2px solid #2979ff; padding-bottom: 4px; margin-top: 2em; }
  .card { background: white; border-radius: 8px; padding: 1.2em; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 1em; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1em; }
  .kpi { font-size: 1.6em; font-weight: 700; color: #2979ff; }
  .label { font-size: 0.85em; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin: 0.5em 0; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f5f5f5; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .bar-container { background: #eee; height: 16px; border-radius: 3px; overflow: hidden; }
  .bar-fill { background: linear-gradient(90deg, #00e5ff, #2979ff); height: 100%; }
  .footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #ddd; color: #888; font-size: 0.85em; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; }
  .pill.ok { background: #e8f5e9; color: #2e7d32; }
  .pill.warn { background: #fff3e0; color: #e65100; }
  .pill.err { background: #ffebee; color: #c62828; }
</style></head><body>
<h1>📊 ai-kit statistics</h1>
<p style="color:#666">Khoảng thời gian: <strong>${sinceLabel}</strong> &middot; Sinh lúc ${new Date().toLocaleString('vi-VN')} &middot; <span class="pill ok">100% local</span></p>

<h2>Tổng quan</h2>
<div class="grid">
  <div class="card"><div class="label">Sessions</div><div class="kpi">${fmtInt(stats.sessions.size)}</div></div>
  <div class="card"><div class="label">API requests</div><div class="kpi">${fmtInt(stats.requests)}</div></div>
  <div class="card"><div class="label">Tổng tokens</div><div class="kpi">${fmtN(stats.totalTokens)}</div></div>
  <div class="card"><div class="label">Giá trị API tương đương</div><div class="kpi">${fmtUsd(stats.totalCost)}</div><div style="font-size:0.8em;color:#888">nếu pay-as-you-go</div></div>
  <div class="card"><div class="label">Cache hit rate</div><div class="kpi">${cacheHitRate.toFixed(1)}%</div></div>
  <div class="card"><div class="label">Lỗi thật</div><div class="kpi">${fmtInt(stats.realErrors)}</div><div style="font-size:0.8em;color:#888">${(stats.realErrors/Math.max(1,stats.requests)*100).toFixed(1)}% rate &middot; ${fmtInt(stats.errorCategories.shell_noise)} noise lọc</div></div>
</div>

<h2>Xu hướng theo ngày</h2>
<div class="card"><table><thead><tr><th>Ngày</th><th class="num">Requests</th><th class="num">Tokens</th><th class="num">Cost</th><th>Bar</th></tr></thead><tbody>
${tableRows(series.slice(-14), s => {
  const max = Math.max(...series.map(x => x.cost), 0.0001);
  return `<tr><td>${s.date}</td><td class="num">${fmtInt(s.requests)}</td><td class="num">${fmtN(s.tokens)}</td><td class="num">${fmtUsd(s.cost)}</td><td><div class="bar-container"><div class="bar-fill" style="width:${(s.cost/max*100).toFixed(1)}%"></div></div></td></tr>`;
})}
</tbody></table></div>

<h2>Top Skills</h2>
<div class="card"><table><thead><tr><th>Skill</th><th class="num">Invocations</th></tr></thead><tbody>
${tableRows(sortObj(stats.bySkill, v => v.invocations).slice(0, 20), ([k,v]) => `<tr><td>${k}</td><td class="num">${fmtInt(v.invocations)}</td></tr>`)}
</tbody></table></div>

<h2>Top Agents (theo cost)</h2>
<div class="card"><table><thead><tr><th>Agent</th><th class="num">Dispatches</th><th class="num">Tokens</th><th class="num">Cost</th></tr></thead><tbody>
${tableRows(sortObj(stats.byAgent, v => v.cost).slice(0, 20), ([k,v]) => `<tr><td>${k}</td><td class="num">${fmtInt(v.dispatches)}</td><td class="num">${fmtN(v.tokens)}</td><td class="num">${fmtUsd(v.cost)}</td></tr>`)}
</tbody></table></div>

<h2>Theo Model</h2>
<div class="card"><table><thead><tr><th>Model</th><th class="num">Requests</th><th class="num">Tokens</th><th class="num">Cost</th></tr></thead><tbody>
${tableRows(sortObj(stats.byModel, v => v.cost), ([k,v]) => `<tr><td>${k}</td><td class="num">${fmtInt(v.requests)}</td><td class="num">${fmtN(v.tokens)}</td><td class="num">${fmtUsd(v.cost)}</td></tr>`)}
</tbody></table></div>

<h2>Top Tools</h2>
<div class="card"><table><thead><tr><th>Tool</th><th class="num">Calls</th></tr></thead><tbody>
${tableRows(sortObj(stats.byTool, v => v).slice(0, 15), ([k,v]) => `<tr><td>${k}</td><td class="num">${fmtInt(v)}</td></tr>`)}
</tbody></table></div>

<h2>Phân loại lỗi</h2>
<div class="card"><table><thead><tr><th>Loại</th><th class="num">Số lượng</th><th class="num">Tỷ lệ</th></tr></thead><tbody>
${tableRows(Object.entries(stats.errorCategories).filter(([,v]) => v > 0).sort((a,b) => b[1] - a[1]), ([k,v]) => `<tr><td>${k}</td><td class="num">${fmtInt(v)}</td><td class="num">${(v/stats.errors*100).toFixed(1)}%</td></tr>`)}
</tbody></table></div>

<div class="footer">
  <p>Cost = giá API list-price tương đương, KHÔNG phải tiền thực trả gói Team/Pro.</p>
  <p>Sinh bởi <code>ai-kit statistics --html</code> &middot; Dữ liệu 100% local.</p>
</div>
</body></html>`;
    fs.writeFileSync(outFile, html);
    console.log(`✓ Đã xuất ${outFile}`);
    console.log(`  Mở: ${process.platform === 'win32' ? 'start ' : 'open '}${outFile}`);
    return;
  }

  // --member-share: anonymized JSON for master to merge across team
  if (args.includes('--member-share')) {
    const memberIdFile = path.join(AI_KIT_HOME, 'member-id');
    let memberId;
    if (exists(memberIdFile)) memberId = fs.readFileSync(memberIdFile, 'utf8').trim();
    else {
      memberId = crypto.randomBytes(8).toString('hex');
      fs.mkdirSync(AI_KIT_HOME, {recursive: true});
      fs.writeFileSync(memberIdFile, memberId);
    }
    const sortedTok = [...stats.requestTokens].sort((a,b) => a - b);
    const totalIn = stats.inputTokens + stats.cacheReadTokens + stats.cacheCreationTokens;
    const share = {
      schema_version: 1,
      anon_member_id: memberId,
      since: new Date(sinceMs).toISOString(),
      generated: new Date().toISOString(),
      window_days: Math.ceil((Date.now() - sinceMs) / 86400_000),
      sessions: stats.sessions.size,
      active_days: stats.days.size,
      requests: stats.requests,
      total_tokens: stats.totalTokens,
      total_cost_api_equivalent: stats.totalCost,
      cache_hit_rate: totalIn > 0 ? stats.cacheReadTokens / totalIn : 0,
      tokens_p50: sortedTok[Math.floor(sortedTok.length * 0.5)] || 0,
      tokens_p95: sortedTok[Math.floor(sortedTok.length * 0.95)] || 0,
      errors_total: stats.errors,
      errors_real: stats.realErrors,
      error_categories: stats.errorCategories,
      by_model: stats.byModel,
      by_skill: stats.bySkill,
      by_agent: Object.fromEntries(Object.entries(stats.byAgent).map(([k,v]) => [k, {dispatches: v.dispatches, tokens: v.tokens, cost: v.cost}])),
      by_tool: stats.byTool,
      by_day: stats.byDay,
      by_hour: stats.byHour,
      by_weekday: stats.byWeekday,
      // NOTE: by_project intentionally omitted (could leak project names)
      // NOTE: error_messages intentionally omitted (could leak file paths)
    };
    const outFile = `ai-kit-share-${memberId}-${new Date().toISOString().slice(0,10)}.json`;
    fs.writeFileSync(outFile, JSON.stringify(share, null, 2));
    console.log(`✓ Đã xuất ${outFile} (anon_member_id: ${memberId})`);
    console.log('  Gửi file này cho master qua email/chat. Toàn bộ project names + file paths đã loại bỏ.');
    return;
  }

  // --merge: master gộp nhiều file share lại
  if (args.includes('--merge')) {
    const files = args.filter(a => a.endsWith('.json'));
    if (!files.length) { err('Cách dùng: ai-kit statistics --merge file1.json file2.json [...]'); process.exit(1); }
    const merged = {
      members: files.length, since: null, generated: new Date().toISOString(),
      total_sessions: 0, total_requests: 0, total_tokens: 0, total_cost_api_equivalent: 0,
      total_errors_real: 0, by_skill: {}, by_agent: {}, by_tool: {}, by_model: {},
      per_member: [],
    };
    for (const f of files) {
      try {
        const d = JSON.parse(fs.readFileSync(f, 'utf8'));
        if (!merged.since || d.since < merged.since) merged.since = d.since;
        merged.total_sessions += d.sessions || 0;
        merged.total_requests += d.requests || 0;
        merged.total_tokens += d.total_tokens || 0;
        merged.total_cost_api_equivalent += d.total_cost_api_equivalent || 0;
        merged.total_errors_real += d.errors_real || 0;
        for (const [k, v] of Object.entries(d.by_skill || {})) {
          const m = merged.by_skill[k] ||= {invocations: 0};
          m.invocations += v.invocations || 0;
        }
        for (const [k, v] of Object.entries(d.by_agent || {})) {
          const m = merged.by_agent[k] ||= {dispatches: 0, tokens: 0, cost: 0};
          m.dispatches += v.dispatches || 0;
          m.tokens += v.tokens || 0;
          m.cost += v.cost || 0;
        }
        for (const [k, v] of Object.entries(d.by_tool || {})) merged.by_tool[k] = (merged.by_tool[k]||0) + v;
        for (const [k, v] of Object.entries(d.by_model || {})) {
          const m = merged.by_model[k] ||= {requests: 0, tokens: 0, cost: 0};
          m.requests += v.requests || 0;
          m.tokens += v.tokens || 0;
          m.cost += v.cost || 0;
        }
        merged.per_member.push({
          anon_member_id: d.anon_member_id,
          requests: d.requests,
          total_tokens: d.total_tokens,
          cost: d.total_cost_api_equivalent,
          cache_hit_rate: d.cache_hit_rate,
          active_days: d.active_days,
        });
      } catch (e) { warn(`Bỏ qua ${f}: ${e.message}`); }
    }
    console.log(JSON.stringify(merged, null, 2));
    return;
  }

  if (json) {
    const sortedTok = [...stats.requestTokens].sort((a,b) => a - b);
    const totalIn = stats.inputTokens + stats.cacheReadTokens + stats.cacheCreationTokens;
    console.log(JSON.stringify({
      since: new Date(sinceMs).toISOString(),
      sessions: stats.sessions.size,
      days: stats.days.size,
      requests: stats.requests,
      totalTokens: stats.totalTokens,
      totalCost: stats.totalCost,
      errors: stats.errors,
      realErrors: stats.realErrors,
      errorCategories: stats.errorCategories,
      tokens: {
        input: stats.inputTokens,
        output: stats.outputTokens,
        cache_read: stats.cacheReadTokens,
        cache_creation: stats.cacheCreationTokens,
        cache_hit_rate: totalIn > 0 ? stats.cacheReadTokens / totalIn : 0,
        avg_per_request: stats.requests ? stats.totalTokens / stats.requests : 0,
        p50: sortedTok[Math.floor(sortedTok.length * 0.5)] || 0,
        p95: sortedTok[Math.floor(sortedTok.length * 0.95)] || 0,
        p99: sortedTok[Math.floor(sortedTok.length * 0.99)] || 0,
        max: sortedTok[sortedTok.length - 1] || 0,
      },
      loc: {added: stats.linesAdded, removed: stats.linesRemoved},
      byHour: stats.byHour,
      byWeekday: stats.byWeekday,
      toolErrors: stats.toolErrors,
      errorMessages: stats.errorMessages,
      byModel: stats.byModel,
      byTool: stats.byTool,
      byAgent: stats.byAgent,
      bySkill: stats.bySkill,
      byProject: stats.byProject,
      byDay: stats.byDay,
      cli: cli.commands,
    }, null, 2));
    return;
  }

  const sinceLabel = sinceArg || '30d';
  const w = _cols(), divider = '─'.repeat(Math.min(w - 4, 80));
  const out = process.stdout;
  out.write(`\n  ${brand('📊 ai-kit statistics')}  ${S.gray}— ${sinceLabel} qua  ·  ${S.reset}${S.green}100% local${S.reset}\n  ${S.dim}${divider}${S.reset}\n`);

  if (stats.parsedFiles === 0) {
    out.write(`\n  ${S.yellow}Không tìm thấy dữ liệu Claude Code${S.reset} ${S.gray}(~/.claude/projects rỗng)${S.reset}\n\n`);
    return;
  }

  const errRate = stats.requests ? (stats.realErrors / stats.requests) * 100 : 0;
  const noiseCount = stats.errorCategories.shell_noise;

  // Plan-aware billing display
  const plan = loadPlan();
  // Estimate plan-equivalent spending pro-rated to the window (assume 30-day month)
  const sinceDays = Math.max(1, Math.ceil((Date.now() - sinceMs) / 86400_000));
  const planPro = plan.monthly_usd * (sinceDays / 30);
  const savingsRatio = stats.totalCost > 0 ? (stats.totalCost / planPro) : 0;

  // Summary card
  const summary = [
    `${S.gray}Sessions      ${S.reset}${S.bcyan}${fmtInt(stats.sessions.size).padStart(8)}${S.reset}    ${S.gray}Ngày hoạt động ${S.reset}${S.bcyan}${String(stats.days.size).padStart(4)}${S.reset}`,
    `${S.gray}API requests  ${S.reset}${S.bcyan}${fmtInt(stats.requests).padStart(8)}${S.reset}    ${S.gray}Lỗi thật      ${S.reset}${S.bcyan}${fmtInt(stats.realErrors).padStart(4)}${S.reset} ${S.gray}(${colorRate(errRate)}${S.gray})  noise: ${S.dim}${fmtInt(noiseCount)}${S.reset}`,
    `${S.gray}Tổng tokens   ${S.reset}${colorTokens(stats.totalTokens)}`,
    `${S.gray}Giá trị API tương đương ${S.reset}${colorCost(stats.totalCost)} ${S.dim}(nếu dùng pay-as-you-go API)${S.reset}`,
    `${S.gray}Thực trả gói "${plan.plan}" ${S.reset}${S.green}${fmtUsd(planPro)}${S.reset} ${S.dim}(\$${plan.monthly_usd}/tháng × ${sinceDays}d/30d)${S.reset}    ${savingsRatio >= 1 ? `${S.green}${S.bold}tiết kiệm ${savingsRatio.toFixed(1)}×${S.reset}` : `${S.gray}đang dùng ${(savingsRatio*100).toFixed(0)}% giá trị gói${S.reset}`}`,
  ].join('\n');
  out.write('\n' + boxen(summary, {
    padding: {top: 0, bottom: 0, left: 1, right: 1},
    borderStyle: 'round', borderColor: 'cyan',
    title: `Tổng quan · ${sinceLabel}`, titleAlignment: 'left',
    margin: {top: 0, bottom: 0, left: 2, right: 0},
  }) + '\n');

  // Alerts (cost/spike/agent/error thresholds)
  const series = dailySeries(stats.byDay, sinceMs);
  const thresholds = loadAlerts();
  const alerts = computeAlerts(stats, series, thresholds);
  if (alerts.length) {
    const lines = alerts.map(a => {
      const icon = a.level === 'crit' ? `${S.red}${S.bold}🔴${S.reset}` : `${S.yellow}🟡${S.reset}`;
      return `${icon} ${a.msg}`;
    }).join('\n');
    out.write('\n' + boxen(lines, {
      padding: {top: 0, bottom: 0, left: 1, right: 1},
      borderStyle: 'round',
      borderColor: alerts.some(a => a.level === 'crit') ? 'red' : 'yellow',
      title: `Cảnh báo (${alerts.length})`, titleAlignment: 'left',
      margin: {top: 0, bottom: 0, left: 2, right: 0},
    }) + '\n');
  }

  // Trend (daily series) — show only if we have at least 2 days of activity
  const activeSeries = series.filter(s => s.requests > 0);
  if (activeSeries.length >= 2) {
    const tokensSpark = sparkline(series.map(s => s.tokens));
    const costSpark = sparkline(series.map(s => s.cost));
    const reqSpark = sparkline(series.map(s => s.requests));
    out.write(`\n  ${S.bold}Xu hướng theo ngày${S.reset} ${S.gray}(${series.length} ngày)${S.reset}\n`);
    out.write(`  ${S.gray}Tokens   ${S.reset}${S.magenta}${tokensSpark}${S.reset}  ${colorTokens(stats.totalTokens)}\n`);
    out.write(`  ${S.gray}Cost     ${S.reset}${S.yellow}${costSpark}${S.reset}  ${colorCost(stats.totalCost)}\n`);
    out.write(`  ${S.gray}Requests ${S.reset}${S.cyan}${reqSpark}${S.reset}  ${S.bcyan}${stats.requests}${S.reset}\n`);

    // Per-day table — last 7 days only
    const last7 = series.slice(-7);
    const maxC = Math.max(...last7.map(s => s.cost), 0.0001);
    printTable('Chi tiết 7 ngày gần nhất', last7.map(s => [
      `${S.cyan}${s.date}${S.reset}`,
      colorCount(s.requests, 500, 100),
      colorTokens(s.tokens),
      colorCost(s.cost),
      `${S.dim}${bar(s.cost / maxC)}${S.reset}`,
    ]), [
      {label: 'Ngày'}, {label: 'Requests', align: 'r'},
      {label: 'Tokens', align: 'r'}, {label: 'Cost', align: 'r'},
      {label: '', align: 'l'},
    ]);
  }

  // ── Performance & efficiency indicators ──────────────────────────────
  const totalIn = stats.inputTokens + stats.cacheReadTokens + stats.cacheCreationTokens;
  const cacheHitRate = totalIn > 0 ? (stats.cacheReadTokens / totalIn) * 100 : 0;
  const avgTokens = stats.requests > 0 ? stats.totalTokens / stats.requests : 0;
  const sortedReqTokens = [...stats.requestTokens].sort((a,b) => a - b);
  const p50 = sortedReqTokens[Math.floor(sortedReqTokens.length * 0.5)] || 0;
  const p95 = sortedReqTokens[Math.floor(sortedReqTokens.length * 0.95)] || 0;
  const p99 = sortedReqTokens[Math.floor(sortedReqTokens.length * 0.99)] || 0;
  const maxReq = sortedReqTokens[sortedReqTokens.length - 1] || 0;
  const colorCacheRate = (r) => {
    const s = fmtPct(r);
    if (r >= 80) return `${S.green}${S.bold}${s}${S.reset}`;
    if (r >= 60) return `${S.green}${s}${S.reset}`;
    if (r >= 40) return `${S.yellow}${s}${S.reset}`;
    return `${S.red}${s}${S.reset}`;
  };

  const perfCard = [
    `${S.gray}Cache hit rate    ${S.reset}${colorCacheRate(cacheHitRate)} ${S.dim}(${fmtN(stats.cacheReadTokens)} cached / ${fmtN(totalIn)} input total)${S.reset}`,
    `${S.gray}Input tokens      ${S.reset}${colorTokens(stats.inputTokens)}    ${S.gray}Output tokens ${S.reset}${colorTokens(stats.outputTokens)}`,
    `${S.gray}Cache creation    ${S.reset}${colorTokens(stats.cacheCreationTokens)}    ${S.gray}Cache read    ${S.reset}${colorTokens(stats.cacheReadTokens)}`,
    `${S.gray}Tokens/request    ${S.reset}avg ${S.cyan}${fmtInt(avgTokens)}${S.reset}  ${S.gray}p50${S.reset} ${fmtInt(p50)}  ${S.gray}p95${S.reset} ${S.yellow}${fmtInt(p95)}${S.reset}  ${S.gray}p99${S.reset} ${S.red}${fmtInt(p99)}${S.reset}  ${S.gray}max${S.reset} ${S.red}${S.bold}${fmtInt(maxReq)}${S.reset}`,
    `${S.gray}LoC modified      ${S.reset}${S.green}+${fmtInt(stats.linesAdded)}${S.reset}  ${S.red}−${fmtInt(stats.linesRemoved)}${S.reset}  ${S.gray}(net ${(stats.linesAdded - stats.linesRemoved >= 0 ? '+' : '')}${fmtInt(stats.linesAdded - stats.linesRemoved)})${S.reset}`,
  ].join('\n');
  out.write('\n' + boxen(perfCard, {
    padding: {top: 0, bottom: 0, left: 1, right: 1},
    borderStyle: 'round', borderColor: 'magenta',
    title: 'Hiệu suất & phân bố token', titleAlignment: 'left',
    margin: {top: 0, bottom: 0, left: 2, right: 0},
  }) + '\n');

  // Hourly heatmap (24 bars)
  const maxHour = Math.max(...stats.byHour, 1);
  const hourBars = stats.byHour.map(v => {
    const blocks = '▁▂▃▄▅▆▇█';
    return v === 0 ? `${S.dim}·${S.reset}` : `${S.cyan}${blocks[Math.min(7, Math.floor((v / maxHour) * 7))]}${S.reset}`;
  }).join('');
  const hourLabel = '0    6    12   18   23';
  out.write(`\n  ${S.bold}Phân bố theo giờ${S.reset} ${S.gray}(0h-23h, theo local time)${S.reset}\n`);
  out.write(`  ${hourBars}\n`);
  out.write(`  ${S.dim}${hourLabel}${S.reset}\n`);
  // Peak hour
  const peakHour = stats.byHour.indexOf(maxHour);
  out.write(`  ${S.gray}Peak: ${S.reset}${S.bcyan}${peakHour}h${S.reset} ${S.gray}(${fmtInt(maxHour)} requests)${S.reset}\n`);

  // Weekday distribution
  const wkLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const maxWk = Math.max(...stats.byWeekday, 1);
  printTable('Phân bố theo thứ', stats.byWeekday.map((v, i) => [
    `${S.cyan}${wkLabels[i]}${S.reset}`,
    colorCount(v, 1000, 100),
    `${S.dim}${bar(v / maxWk)}${S.reset}`,
  ]), [{label: 'Thứ'}, {label: 'Requests', align: 'r'}, {label: '', align: 'l'}]);

  // Error categories breakdown
  if (stats.errors > 0) {
    const cats = stats.errorCategories;
    const total = stats.errors;
    const catLabels = {
      workflow:   {label: 'workflow',   desc: 'Edit-before-Read, String not found... — workflow Claude', color: S.yellow},
      shell_real: {label: 'shell_real', desc: 'Lỗi shell thật (exit ≥2 hoặc command fail)',               color: S.red},
      shell_noise:{label: 'shell_noise',desc: 'grep no-match, git diff --quiet... — KHÔNG phải lỗi',     color: S.dim},
      http:       {label: 'http',       desc: 'HTTP 4xx/5xx (404, 500...)',                                color: S.red},
      other:      {label: 'other',      desc: 'Chưa phân loại',                                            color: S.gray},
    };
    const catRows = Object.entries(cats)
      .filter(([,v]) => v > 0)
      .sort((a,b) => b[1] - a[1])
      .map(([k, v]) => {
        const m = catLabels[k];
        return [
          `${m.color}${m.label}${S.reset}`,
          colorCount(v, 100, 20),
          `${S.dim}${(v/total*100).toFixed(1)}%${S.reset}`,
          `${S.dim}${m.desc}${S.reset}`,
        ];
      });
    printTable(`Phân loại lỗi (${fmtInt(stats.errors)} tổng · ${fmtInt(stats.realErrors)} lỗi thật)`,
      catRows, [
        {label: 'Loại'}, {label: 'Số lượng', align: 'r'}, {label: 'Tỷ lệ', align: 'r'}, {label: 'Mô tả'},
      ]);
  }

  // Top tool errors (real only — already filtered)
  if (Object.keys(stats.toolErrors).length) {
    const errEntries = Object.entries(stats.toolErrors).sort((a,b) => b[1] - a[1]).slice(0, top);
    printTable('Tool có nhiều lỗi thật nhất', errEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      `${S.red}${fmtInt(v)}${S.reset}`,
      `${S.dim}${bar(v / errEntries[0][1])}${S.reset}`,
    ]), [{label: 'Tool'}, {label: 'Errors', align: 'r'}, {label: '', align: 'l'}]);

    const msgEntries = Object.entries(stats.errorMessages).sort((a,b) => b[1] - a[1]).slice(0, 8);
    if (msgEntries.length) {
      out.write(`\n  ${S.bold}Top lỗi thật (đã lọc noise)${S.reset}\n`);
      msgEntries.forEach(([m, c]) => out.write(`  ${S.red}${String(fmtInt(c)).padStart(5)}${S.reset} ${S.gray}${m}${S.reset}\n`));
    }
  }

  // Top skills
  const skillEntries = Object.entries(stats.bySkill).sort((a,b) => b[1].invocations - a[1].invocations).slice(0, top);
  if (skillEntries.length) {
    const max = skillEntries[0][1].invocations;
    printTable(`Top ${skillEntries.length} Skills`, skillEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v.invocations, 20, 5),
      `${S.dim}${bar(v.invocations / max)}${S.reset}`,
    ]), [{label: 'Skill'}, {label: 'Invocations', align: 'r'}, {label: '', align: 'l'}]);
  } else out.write(`\n  ${S.gray}(Chưa có Skill invocation nào)${S.reset}\n`);

  // Top agents
  const agentEntries = Object.entries(stats.byAgent).sort((a,b) => b[1].cost - a[1].cost).slice(0, top);
  if (agentEntries.length) {
    const maxCost = Math.max(...agentEntries.map(([,v]) => v.cost), 0.0001);
    printTable(`Top ${agentEntries.length} Agents (sort theo cost)`, agentEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v.dispatches, 10, 3),
      colorTokens(v.tokens),
      colorCost(v.cost),
      `${S.dim}${bar(v.cost / maxCost)}${S.reset}`,
    ]), [
      {label: 'Agent'}, {label: 'Dispatches', align: 'r'},
      {label: 'Tokens', align: 'r'}, {label: 'Cost', align: 'r'},
      {label: '', align: 'l'},
    ]);
  }

  // ── Wave 5: tuning indicators ────────────────────────────────────
  const fmtDur = (ms) => {
    if (!ms || ms < 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60_000) return `${(ms/1000).toFixed(1)}s`;
    return `${(ms/60_000).toFixed(1)}m`;
  };
  const median = (arr) => { if (!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[Math.floor(s.length/2)]; };

  // Skill efficiency: invocations + tokens + cost + median duration
  const skillEffEntries = Object.entries(stats.skillStats || {})
    .filter(([,v]) => v.invocations > 0)
    .sort((a,b) => b[1].cost - a[1].cost)
    .slice(0, top);
  if (skillEffEntries.length) {
    printTable('Skill efficiency (cost + duration heuristic)', skillEffEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v.invocations, 20, 5),
      colorTokens(v.tokens),
      colorCost(v.cost),
      v.invocations > 0 ? `${S.dim}${fmtUsd(v.cost / v.invocations)}/inv${S.reset}` : '-',
      `${S.dim}${fmtDur(median(v.durations))}${S.reset}`,
    ]), [
      {label: 'Skill'}, {label: 'Inv', align: 'r'},
      {label: 'Tokens', align: 'r'}, {label: 'Cost', align: 'r'},
      {label: 'Avg/inv', align: 'r'}, {label: 'Median dur', align: 'r'},
    ]);
  }

  // Agent duration percentiles
  const agentDurEntries = Object.entries(stats.agentDurations || {})
    .filter(([,arr]) => arr.length > 0)
    .map(([k, arr]) => {
      const sorted = [...arr].sort((a,b) => a-b);
      return [k, sorted.length, sorted[Math.floor(sorted.length*0.5)], sorted[Math.floor(sorted.length*0.95)], sorted[sorted.length-1]];
    })
    .sort((a,b) => b[3] - a[3])  // sort by p95 desc
    .slice(0, top);
  if (agentDurEntries.length) {
    printTable('Agent duration (wall-clock từ subagent files)', agentDurEntries.map(([k, n, p50, p95, max]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(n, 10, 3),
      `${S.dim}${fmtDur(p50)}${S.reset}`,
      `${S.yellow}${fmtDur(p95)}${S.reset}`,
      `${S.red}${fmtDur(max)}${S.reset}`,
    ]), [
      {label: 'Agent'}, {label: 'Samples', align: 'r'},
      {label: 'p50', align: 'r'}, {label: 'p95', align: 'r'}, {label: 'max', align: 'r'},
    ]);
  }

  // Prompt versions — flag if multiple hashes seen (= prompt was edited mid-window)
  const versions = Object.entries(stats.promptVersions || {})
    .filter(([,hashes]) => Object.keys(hashes).length >= 2)
    .map(([k, hashes]) => [k, Object.entries(hashes).map(([h,c]) => `${h}=${c}`).join(', ')]);
  if (versions.length) {
    out.write(`\n  ${S.bold}Prompt version history${S.reset} ${S.gray}(đã sửa giữa window — A/B comparable)${S.reset}\n`);
    versions.forEach(([k, v]) => out.write(`  ${S.yellow}~${S.reset} ${S.cyan}${k}${S.reset}  ${S.gray}${v}${S.reset}\n`));
  }

  // Tool n-gram (top consecutive pairs)
  const ngrams = Object.entries(stats.toolNgrams || {}).sort((a,b) => b[1] - a[1]).slice(0, top);
  if (ngrams.length) {
    const max = ngrams[0][1];
    printTable(`Top tool sequences (n-gram pair)`, ngrams.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v, 200, 50),
      `${S.dim}${bar(v / max)}${S.reset}`,
    ]), [{label: 'Pair'}, {label: 'Count', align: 'r'}, {label: '', align: 'l'}]);
  }

  // Session efficiency
  const sessions = Object.values(stats.sessionStats || {}).filter(s => s.turns > 0);
  if (sessions.length) {
    const turns = sessions.map(s => s.turns).sort((a,b) => a-b);
    const tokens = sessions.map(s => s.tokens).sort((a,b) => a-b);
    const costs = sessions.map(s => s.cost).sort((a,b) => a-b);
    const erroredCount = sessions.filter(s => s.errored).length;
    const withEdits = sessions.filter(s => s.edits > 0);
    const ttfeArr = withEdits.filter(s => s.firstTs && s.firstEditTs).map(s => s.firstEditTs - s.firstTs).sort((a,b) => a-b);
    const ttfeMedian = ttfeArr.length ? ttfeArr[Math.floor(ttfeArr.length/2)] : 0;
    const card = [
      `${S.gray}Sessions tổng     ${S.reset}${S.bcyan}${fmtInt(sessions.length).padStart(6)}${S.reset}    ${S.gray}có Edit ${S.reset}${S.bcyan}${withEdits.length}${S.reset} ${S.gray}(${(withEdits.length/sessions.length*100).toFixed(0)}%)${S.reset}`,
      `${S.gray}Turns/session     ${S.reset}p50 ${S.cyan}${turns[Math.floor(turns.length*0.5)]}${S.reset}  p95 ${S.yellow}${turns[Math.floor(turns.length*0.95)]}${S.reset}  max ${S.red}${turns[turns.length-1]}${S.reset}`,
      `${S.gray}Tokens/session    ${S.reset}p50 ${colorTokens(tokens[Math.floor(tokens.length*0.5)])}  p95 ${colorTokens(tokens[Math.floor(tokens.length*0.95)])}  max ${colorTokens(tokens[tokens.length-1])}`,
      `${S.gray}Cost/session      ${S.reset}p50 ${colorCost(costs[Math.floor(costs.length*0.5)])}  p95 ${colorCost(costs[Math.floor(costs.length*0.95)])}  max ${colorCost(costs[costs.length-1])}`,
      `${S.gray}Time-to-first-Edit${S.reset} median ${S.cyan}${fmtDur(ttfeMedian)}${S.reset} ${S.dim}(thời gian research trước khi action)${S.reset}`,
      `${S.gray}Sessions có lỗi   ${S.reset}${erroredCount > 0 ? S.red : S.green}${erroredCount}${S.reset} ${S.gray}(${(erroredCount/sessions.length*100).toFixed(1)}%)${S.reset}`,
    ].join('\n');
    out.write('\n' + boxen(card, {
      padding: {top: 0, bottom: 0, left: 1, right: 1},
      borderStyle: 'round', borderColor: 'green',
      title: 'Session efficiency', titleAlignment: 'left',
      margin: {top: 0, bottom: 0, left: 2, right: 0},
    }) + '\n');
  }

  // Top tools
  const toolEntries = Object.entries(stats.byTool).sort((a,b) => b[1] - a[1]).slice(0, top);
  if (toolEntries.length) {
    const max = toolEntries[0][1];
    printTable(`Top ${toolEntries.length} Tools`, toolEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v, 500, 100),
      `${S.dim}${bar(v / max)}${S.reset}`,
    ]), [{label: 'Tool'}, {label: 'Calls', align: 'r'}, {label: '', align: 'l'}]);
  }

  // By model
  const modelEntries = Object.entries(stats.byModel).sort((a,b) => b[1].cost - a[1].cost);
  if (modelEntries.length) {
    const totalCost = modelEntries.reduce((s, [,v]) => s + v.cost, 0) || 1;
    printTable('Theo Model', modelEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v.requests, 1000, 100),
      colorTokens(v.tokens),
      colorCost(v.cost),
      `${S.dim}${(v.cost/totalCost*100).toFixed(1).padStart(5)}%${S.reset}`,
    ]), [
      {label: 'Model'}, {label: 'Requests', align: 'r'},
      {label: 'Tokens', align: 'r'}, {label: 'Cost', align: 'r'},
      {label: 'Share', align: 'r'},
    ]);
  }

  // By project
  const projEntries = Object.entries(stats.byProject).sort((a,b) => b[1] - a[1]).slice(0, top);
  if (projEntries.length) {
    const max = projEntries[0][1];
    printTable(`Top ${projEntries.length} Projects (số message)`, projEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v, 1000, 200),
      `${S.dim}${bar(v / max)}${S.reset}`,
    ]), [{label: 'Project'}, {label: 'Messages', align: 'r'}, {label: '', align: 'l'}]);
  }

  // CLI commands
  const cliEntries = Object.entries(cli.commands).sort((a,b) => b[1] - a[1]).slice(0, top);
  if (cliEntries.length) {
    const max = cliEntries[0][1];
    printTable('ai-kit CLI commands', cliEntries.map(([k, v]) => [
      `${S.cyan}${k}${S.reset}`,
      colorCount(v, 50, 10),
      `${S.dim}${bar(v / max)}${S.reset}`,
    ]), [{label: 'Command'}, {label: 'Runs', align: 'r'}, {label: '', align: 'l'}]);
  }

  out.write(`\n  ${S.dim}${divider}${S.reset}\n`);
  out.write(`  ${S.gray}Cờ:${S.reset}  --since ${S.cyan}7d|30d|3m|24h${S.reset}  ·  --top ${S.cyan}N${S.reset}  ·  --json\n`);
  out.write(`  ${S.yellow}Lưu ý:${S.reset} cột Cost = ${S.bold}giá API list-price tương đương${S.reset}, ${S.bold}KHÔNG${S.reset} phải tiền thực trả.\n`);
  out.write(`         Gói Team/Pro flat-rate — dùng nhiều = tiết kiệm so với pay-as-you-go.\n`);
  out.write(`  ${S.gray}Tuỳ biến gói:${S.reset} ~/.ai-kit/billing.json ${S.dim}({"plan":"team","monthly_usd":100})${S.reset}\n`);
  out.write(`  ${S.gray}Tuỳ biến cảnh báo:${S.reset} ~/.ai-kit/alerts.json ${S.dim}(total_cost_warn, daily_spike_factor, agent_cost_warn, error_rate_warn)${S.reset}\n`);
  out.write(`  ${S.dim}Dữ liệu 100% local — không gửi đi đâu.${S.reset}\n\n`);
};

// ─── help <command> ────────────────────────────────────────────────────
const COMMAND_HELP = {
  update:  { usage: 'ai-kit update [--quiet]',                  desc: 'Pull latest team-ai-config, redeploy configs, refresh MCP image.',     notes: ['Fails fast if local uncommitted changes exist.', 'Auto-snapshots configs before overwriting — use `ai-kit rollback` to undo.', 'Deploy is atomic: writes to .tmp then renames into place.'] },
  upgrade: { usage: 'ai-kit upgrade',                           desc: 'Update Node.js deps in ~/.ai-kit (npm update). Run after major dep bumps.' },
  status:  { usage: 'ai-kit status [--json]',                   desc: 'Show team-config version, deployed counts, MCP health.',               flags: {'--json': 'Machine-readable JSON output (CI/scripts)'} },
  doctor:  { usage: 'ai-kit doctor [--json]',                   desc: 'Verify git, docker, node ≥18, repo path, PATH.',                      notes: ['Exit code 1 when any required check fails.'],              flags: {'--json': 'Machine-readable JSON output'} },
  rollback:{ usage: 'ai-kit rollback [N]',                      desc: 'Restore both ~/.claude and ~/.cursor from snapshot N (default: newest).', notes: ['Use `ai-kit list-backups` to see indexes.', 'Auto-creates pre-rollback safety backup first.'] },
  clean:   { usage: 'ai-kit clean [--keep N] --yes',            desc: 'Delete old backup snapshots + prune dangling Docker images.',           flags: {'--keep N': 'Keep N most recent (default 3)', '--yes | -y': 'Required to confirm'} },
  reset:   { usage: 'ai-kit reset [--yes]',                     desc: 'Discard all local edits to team-ai-config + pull from origin.',         flags: {'--yes | -y': 'Required when repo is dirty'} },
  publish: { usage: 'ai-kit publish "<msg>"',                   desc: 'Pack live ~/.claude+~/.cursor → repo, commit + push.',                  notes: ['Fast-fails with git ls-remote check before making any changes.'] },
  mcp:     { usage: 'ai-kit mcp <verb>',                        desc: 'Control the etc-platform MCP Docker container.',                        flags: { start:'docker compose up -d', stop:'docker compose down', restart:'docker compose restart', logs:'Tail last 200 lines', pull:'Pull latest image', status:'Container state + API URLs (http://localhost:8001)' } },
  pack:    { usage: 'ai-kit pack',                              desc: 'Snapshot ~/.claude+~/.cursor agents/skills → repo working tree.' },
  diff:    { usage: 'ai-kit diff',                              desc: 'Show local repo vs origin diff (git status + diff --stat).' },
  statistics: { usage: 'ai-kit statistics [--since 30d] [--top 10] [--json|--html|--member-share]', desc: 'Local-only telemetry: top skills/agents/tools/models + token cost. Parses ~/.claude/projects/*.jsonl.', flags: {'--since': 'Time window: 7d, 30d, 3m, 24h (default 30d)', '--top': 'Top-N rows per table (default 10)', '--json': 'Machine-readable JSON', '--html [file]': 'Standalone HTML report (offline-shareable)', '--member-share': 'Anonymized JSON for master to merge', '--merge f1 f2': '(master) Gộp nhiều file member-share'}, notes: ['No data leaves the machine.', 'Cost is estimated using public Anthropic pricing — actual billing may differ.'] },
  verify:     { usage: 'ai-kit verify [--restore | --update]', desc: 'Kiểm tra toàn vẹn ~/.claude+~/.cursor (manifest SHA256). Phát hiện local drift.', flags: {'--restore | -r': 'Chạy update để khôi phục từ team config', '--update': 'Chấp nhận trạng thái hiện tại — ghi manifest mới'} },
  search:     { usage: 'ai-kit search <term> [--scope all|docs|agents|skills]', desc: 'Tìm full-text xuyên docs + agents + skills. Group theo file, top 30 file.' },
  config:     { usage: 'ai-kit config <list|get|set> [<file>.<key>] [<value>]', desc: 'Quản lý ~/.ai-kit/{billing,alerts}.json. File ∈ billing|alerts.', notes: ['Ví dụ: ai-kit config set billing.monthly_usd 200', 'Ví dụ: ai-kit config get alerts.total_cost_warn'] },
  schedule:   { usage: 'ai-kit schedule <show | update [--daily|--weekly|--monthly] | remove>', desc: 'Đặt lịch tự động ai-kit update qua Task Scheduler (Windows) hoặc crontab (Unix).', notes: ['Default: weekly Monday 09:00', 'Lệnh chạy: ai-kit update --quiet'] },
};
const cmdHelp = (topic) => {
  const resolved = ({up:'update',st:'status',dr:'doctor',upg:'upgrade'})[topic] || topic;
  if (MAINTAINER_COMMANDS.has(resolved) && !IS_MAINTAINER) {
    err(`Lệnh "${resolved}" chỉ dành cho owner — không có trong help.`);
    process.exit(1);
  }
  const entry = COMMAND_HELP[resolved];
  if (!entry) { renderStaticLater(h(Help)); return; }
  const w = _cols(), bar = '─'.repeat(w - 4);
  const out = process.stdout;
  out.write(`\n  ${brand(`ai-kit ${resolved}`)}\n  ${S.dim}${bar}${S.reset}\n\n`);
  out.write(`  ${S.bold}Usage${S.reset}   ${entry.usage}\n\n`);
  out.write(`  ${S.bold}What${S.reset}    ${entry.desc}\n`);
  if (entry.flags) {
    out.write(`\n  ${S.bold}Flags${S.reset}\n`);
    for (const [f, d] of Object.entries(entry.flags))
      out.write(`  ${S.gray}  ${f.padEnd(20)}${S.reset}${d}\n`);
  }
  if (entry.notes?.length) {
    out.write(`\n  ${S.bold}Notes${S.reset}\n`);
    entry.notes.forEach(n => out.write(`  ${S.gray}  · ${S.reset}${n}\n`));
  }
  out.write(`\n  ${S.dim}${bar}${S.reset}\n\n`);
};

// ─── History (Batch 4) ─────────────────────────────────────────────────
const HISTORY_FILE = path.join(AI_KIT_HOME, 'history');
const HISTORY_MAX = 100;
// History format: "ISO_TIMESTAMP\tcommand args"  (TSV, sortable, since-filterable)
// Old format (line = "command args") still supported on read for backward compat.
const parseHistLine = (l) => {
  const tabIdx = l.indexOf('\t');
  if (tabIdx > 0 && /^\d{4}-\d{2}-\d{2}T/.test(l.slice(0, tabIdx))) {
    return {ts: Date.parse(l.slice(0, tabIdx)), cmd: l.slice(tabIdx + 1)};
  }
  return {ts: 0, cmd: l};
};
const recordHistory = (argv) => {
  if (!argv?.length) return;
  const cmdLine = argv.join(' ');
  if (['!!', 'history', '-h', '--help', '-v', '--version'].includes(argv[0])) return;
  try {
    fs.mkdirSync(AI_KIT_HOME, {recursive: true});
    let lines = exists(HISTORY_FILE) ? fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean) : [];
    if (lines.length && parseHistLine(lines[lines.length - 1]).cmd === cmdLine) return;
    lines.push(`${new Date().toISOString()}\t${cmdLine}`);
    if (lines.length > HISTORY_MAX) lines = lines.slice(-HISTORY_MAX);
    fs.writeFileSync(HISTORY_FILE, lines.join('\n') + '\n');
  } catch {}
};
const lastHistory = () => {
  if (!exists(HISTORY_FILE)) return null;
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.length ? parseHistLine(lines[lines.length - 1]).cmd : null;
};
const cmdShowHistory = () => {
  if (!exists(HISTORY_FILE)) { info('Chưa có lịch sử.'); return; }
  const lines = fs.readFileSync(HISTORY_FILE, 'utf8').split('\n').filter(Boolean);
  const w = _cols(), divider = '─'.repeat(w - 4);
  process.stdout.write(`\n  ${brand('Lịch sử lệnh')}  ${S.gray}${lines.length}/${HISTORY_MAX}${S.reset}\n  ${S.dim}${divider}${S.reset}\n\n`);
  lines.slice(-30).forEach((l, i) => {
    const {ts, cmd} = parseHistLine(l);
    const idx = lines.length - Math.min(lines.length, 30) + i + 1;
    const tsStr = ts ? new Date(ts).toLocaleString('vi-VN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : '       ';
    process.stdout.write(`  ${S.gray}${String(idx).padStart(3)}${S.reset}  ${S.dim}${tsStr.padEnd(11)}${S.reset}  ai-kit ${S.cyan}${cmd}${S.reset}\n`);
  });
  process.stdout.write(`\n  ${S.gray}Chạy lại lệnh cuối: ${S.reset}ai-kit !!\n\n`);
};

// ─── Splash banner (Batch 1) ───────────────────────────────────────────
const printSplash = () => {
  let banner = '';
  try {
    banner = figlet.textSync('ai-kit', {font: 'Slant', horizontalLayout: 'fitted'});
  } catch { banner = 'ai-kit'; }
  const lines = banner.split('\n').filter(l => l.trim());
  process.stdout.write('\n');
  lines.forEach(l => process.stdout.write('  ' + (USE_TRUECOLOR ? gradient(l, BRAND) : `${S.bcyan}${l}${S.reset}`) + '\n'));
  process.stdout.write(`  ${S.gray}Team AI config manager  ·  v${VERSION}${S.reset}\n`);
};

const printStatusBadges = () => {
  const sd = (() => { try { return buildStatusData(); } catch { return null; } })();
  const dock = dockerHealth();
  const dockBadge = dock === 'running' ? `${S.green}● Docker${S.reset}` : `${S.yellow}○ Docker${S.reset}`;
  const counts = sd
    ? `${S.gray}agents ${S.reset}${sd.claudeAgents}+${sd.cursorAgents}  ${S.gray}skills ${S.reset}${sd.claudeSkills}+${sd.cursorSkills}`
    : `${S.gray}repo: chưa cài${S.reset}`;
  process.stdout.write(`  ${dockBadge}  ${S.gray}·${S.reset}  ${counts}\n\n`);
};

// ─── Known commands list (for did-you-mean + menu) ─────────────────────
const KNOWN_COMMANDS = [
  'update', 'upgrade', 'status', 'doctor', 'doc', 'docs', 'logs', 'mcp',
  'reset', 'rollback', 'list-backups', 'clean', 'pack', 'publish', 'diff',
  'edit', 'uninstall', 'install', 'help', 'version', 'history', 'statistics',
  'verify', 'search', 'config', 'schedule',
];

// suggestCommand moved to ./lib/util.mjs — wrapper using local KNOWN_COMMANDS list
// Filter out maintainer commands for member sessions (no false hints)
const suggestForInput = (input) => suggestCommand(input,
  IS_MAINTAINER ? KNOWN_COMMANDS : KNOWN_COMMANDS.filter(c => !MAINTAINER_COMMANDS.has(c))
);

// ─── Interactive menu (Batch 1) ────────────────────────────────────────
const BACK = '__back__', EXIT = '__exit__';
const printBreadcrumb = (crumbs) => {
  const trail = ['ai-kit', ...crumbs].join(` ${S.gray}›${S.reset} ${S.cyan}`);
  process.stdout.write(`  ${S.cyan}${trail}${S.reset}\n\n`);
};

const askSelect = async (message, choices, opts = {}) => {
  try {
    return await select({message, pageSize: opts.pageSize || 14, choices, loop: false});
  } catch { process.exit(0); }
};

const menuMcp = async () => {
  printBreadcrumb(['mcp']);
  const v = await askSelect('Chọn lệnh MCP:', [
    {name: 'status      — Trạng thái container + URLs', value: 'status'},
    {name: 'start       — docker compose up -d', value: 'start'},
    {name: 'stop        — docker compose down', value: 'stop'},
    {name: 'restart     — docker compose restart', value: 'restart'},
    {name: 'logs        — Tail 200 dòng cuối', value: 'logs'},
    {name: 'pull        — Pull image mới nhất', value: 'pull'},
    {name: '← Quay lại', value: BACK},
    {name: 'thoát', value: EXIT},
  ]);
  return v === BACK ? null : v === EXIT ? (process.exit(0), null) : ['mcp', v];
};

const menuDocs = async () => {
  printBreadcrumb(['doc']);
  let topics = [];
  try {
    const docsDir = path.join(REPO_DIR, 'docs');
    const root = readDocItems(docsDir).filter(it => it.name !== 'README');
    const wf = readDocItems(path.join(docsDir, 'workflows')).map(it => ({...it, name: `workflows/${it.name}`}));
    const ref = readDocItems(path.join(docsDir, 'reference')).map(it => ({...it, name: `reference/${it.name}`}));
    topics = [...root, ...wf, ...ref];
  } catch {}
  const choices = [
    {name: 'index       — Mục lục tài liệu', value: 'index'},
    {name: 'skills      — Danh mục skills', value: 'skills'},
    {name: 'agents      — Danh mục agents', value: 'agents'},
    {name: 'search      — Tìm kiếm full-text', value: '__search__'},
    ...(topics.length ? [{name: '── chọn topic ──', value: '__sep__', disabled: ' '}] : []),
    ...topics.slice(0, 30).map(t => ({name: `${t.name.padEnd(28)}— ${t.title}`, value: t.name})),
    {name: '← Quay lại', value: BACK},
    {name: 'thoát', value: EXIT},
  ];
  const v = await askSelect('Chọn tài liệu:', choices);
  if (v === BACK) return null;
  if (v === EXIT) process.exit(0);
  if (v === 'index') return ['doc'];
  if (v === '__search__') {
    process.stdout.write(`  ${S.gray}Mở terminal mới và chạy: ${S.reset}ai-kit doc --search <từ khoá>\n\n`);
    process.exit(0);
  }
  return ['doc', v];
};

const menuBackups = async () => {
  printBreadcrumb(['backups']);
  const v = await askSelect('Chọn thao tác sao lưu:', [
    {name: 'list-backups   — Liệt kê snapshots', value: 'list-backups'},
    {name: 'rollback       — Khôi phục snapshot mới nhất', value: 'rollback'},
    {name: 'clean --yes    — Xoá snapshots cũ + prune Docker', value: 'clean:--yes'},
    {name: '← Quay lại', value: BACK},
    {name: 'thoát', value: EXIT},
  ]);
  if (v === BACK) return null;
  if (v === EXIT) process.exit(0);
  return v.split(':');
};

const menuMaintainer = async () => {
  printBreadcrumb(['maintainer']);
  const v = await askSelect('Chọn lệnh maintainer:', [
    {name: 'pack        — Snapshot ~/.claude+~/.cursor → repo', value: 'pack'},
    {name: 'diff        — Xem khác biệt local vs origin', value: 'diff'},
    {name: 'edit        — Mở repo trong $EDITOR', value: 'edit'},
    {name: 'publish     — pack + commit + push (cần message)', value: '__publish__'},
    {name: 'reset       — Bỏ thay đổi local + pull mới', value: 'reset'},
    {name: '← Quay lại', value: BACK},
    {name: 'thoát', value: EXIT},
  ]);
  if (v === BACK) return null;
  if (v === EXIT) process.exit(0);
  if (v === '__publish__') {
    process.stdout.write(`  ${S.gray}Publish cần commit message — chạy: ${S.reset}ai-kit publish "<message>"\n\n`);
    process.exit(0);
  }
  return [v];
};

const runInteractiveMenu = async () => {
  printSplash();
  printStatusBadges();
  while (true) {
    const v = await askSelect('Chọn nhóm:', [
      {name: 'update         — Cập nhật team config + MCP', value: 'update'},
      {name: 'status         — Phiên bản + counts + MCP health', value: 'status'},
      {name: 'doc       ›    — Tài liệu (index/skills/agents/topic)', value: '__doc__'},
      {name: 'mcp       ›    — Điều khiển MCP container', value: '__mcp__'},
      {name: 'backups   ›    — Sao lưu / khôi phục', value: '__backups__'},
      ...(IS_MAINTAINER ? [{name: 'maintainer›    — pack/publish/diff/edit/reset', value: '__maint__'}] : []),
      {name: 'doctor         — Kiểm tra môi trường', value: 'doctor'},
      {name: 'statistics     — Top skills/agents/tokens (local-only)', value: 'statistics'},
      {name: 'history        — Xem lịch sử lệnh', value: 'history'},
      {name: 'help           — Xem toàn bộ lệnh', value: 'help'},
      {name: 'thoát', value: EXIT},
    ]);
    if (v === EXIT) process.exit(0);
    if (v === '__mcp__')      { const r = await menuMcp();        if (r) return r; continue; }
    if (v === '__doc__')      { const r = await menuDocs();       if (r) return r; continue; }
    if (v === '__backups__')  { const r = await menuBackups();    if (r) return r; continue; }
    if (v === '__maint__')    { const r = await menuMaintainer(); if (r) return r; continue; }
    return [v];
  }
};

// ─── Dispatch ──────────────────────────────────────────────────────────
let cmd = _rawArgs[0];
let args = _rawArgs.slice(1);

// `!!` — re-run last command
if (cmd === '!!') {
  const last = lastHistory();
  if (!last) { err('Chưa có lệnh nào trong lịch sử.'); process.exit(1); }
  process.stdout.write(`${S.gray}  ↻ ai-kit ${last}${S.reset}\n`);
  const parts = last.split(/\s+/);
  cmd = parts[0]; args = parts.slice(1);
}

// `history` builtin
if (cmd === 'history') { cmdShowHistory(); process.exit(0); }

const aliasMap = {
  '-v': 'version', '--version': 'version',
  '-h': 'help', '--help': 'help',
  'up': 'update', 'st': 'status', 'dr': 'doctor', 'doc': 'docs',
  'upg': 'upgrade', 'stat': 'statistics', 'stats': 'statistics',
  // 1-letter shortcuts (Batch 3)
  's': 'status', 'u': 'update', 'd': 'docs', 'm': 'mcp',
  'r': 'rollback', 'h': 'help', 'v': 'version', 'l': 'logs',
};

// No-arg interactive menu (Batch 1) — only when stdin is TTY and not piped
if (!cmd && process.stdin.isTTY && process.stdout.isTTY && !process.env.CI) {
  const picked = await runInteractiveMenu();
  cmd = picked[0]; args = picked.slice(1);
}

const resolved = aliasMap[cmd] || cmd || 'help';

// Block maintainer-only commands for member sessions
if (MAINTAINER_COMMANDS.has(resolved) && !IS_MAINTAINER) {
  console.error(`${C.red}  ✗ Lệnh "${resolved}" chỉ dành cho owner/maintainer.${C.reset}`);
  console.error(`${C.gray}    Nếu bạn là owner: ${C.reset}export AI_KIT_MAINTAINER=1${C.gray}, hoặc:${C.reset}`);
  console.error(`${C.gray}                       ${C.reset}touch ~/.ai-kit/.maintainer\n`);
  process.exit(1);
}

// Record history (after resolution, before dispatch) — Batch 4
if (cmd && resolved !== 'help' && resolved !== 'version') {
  recordHistory([cmd, ...args]);
}

switch (resolved) {
  case 'help':
    if (args[0]) { cmdHelp(args[0]); break; }
    renderStaticLater(h(Help));
    break;
  case 'version':
    renderStaticLater(h(Version));
    break;
  case 'status': {
    ensureRepo();
    const sd = buildStatusData();
    if (args.includes('--json')) {
      let mcpState = 'unknown';
      try {
        const {stdout} = execaSync('docker', ['ps', '--format', '{{.Names}}|{{.Status}}'], {stdio: ['ignore', 'pipe', 'ignore']});
        const line = stdout.split('\n').find(l => l.startsWith('etc-platform|'));
        mcpState = line ? line.split('|')[1] : 'stopped';
      } catch {}
      console.log(JSON.stringify({
        version: VERSION,
        teamConfig: {sha: sd.sha, date: sd.date, msg: sd.msg},
        deployed: {claudeAgents: sd.claudeAgents, claudeSkills: sd.claudeSkills, cursorAgents: sd.cursorAgents, cursorSkills: sd.cursorSkills},
        mcp: {state: mcpState},
      }, null, 2));
      break;
    }
    render(h(Status, sd));   // self-exits via useApp
    break;
  }
  case 'doctor': {
    ensureRepo();
    const dd = buildDoctorData();
    if (args.includes('--json')) {
      console.log(JSON.stringify({
        allOk: dd.allRequiredOk,
        nodeVersion: dd.nodeVersion,
        checks: dd.checks.map(c => ({name: c.name, required: c.required, ok: c.ok})),
        dockerDaemon: dd.dockerDaemon,
        repoOk: dd.repoOk,
        pathOk: dd.pathOk,
      }, null, 2));
      if (!dd.allRequiredOk) process.exitCode = 1;
      break;
    }
    renderStaticLater(h(Doctor, dd));
    if (!dd.allRequiredOk) process.exitCode = 1;
    break;
  }
  case 'docs':
    docCommand(args);
    break;
  case 'update':       cmdUpdate(); break;
  case 'upgrade':      cmdUpgrade(); break;
  case 'mcp':          cmdMcp(args); break;
  case 'logs':         cmdLogs(); break;
  case 'reset':        cmdReset(args); break;
  case 'list-backups': cmdListBackups(); break;
  case 'rollback':     cmdRollback(args); break;
  case 'clean':        cmdClean(args); break;
  case 'statistics':   cmdStatistics(args); break;
  case 'verify':       cmdVerify(args); break;
  case 'search':       cmdSearch(args); break;
  case 'config':       cmdConfig(args); break;
  case 'schedule':     cmdSchedule(args); break;
  case 'pack':         cmdPack(); break;
  case 'publish':      cmdPublish(args); break;
  case 'diff':         cmdDiff(); break;
  case 'edit':         cmdEdit(); break;
  case 'uninstall':    cmdUninstall(args); break;
  case 'install':      cmdInstall(); break;
  default: {
    console.error(`${C.red}  ✗ Lệnh không xác định: ${cmd}${C.reset}`);
    const sugg = suggestForInput(cmd);
    if (sugg.length) {
      console.error(`${S.gray}    Có phải bạn định gõ:${S.reset}`);
      sugg.forEach(s => console.error(`      ${S.cyan}ai-kit ${s}${S.reset}`));
    } else {
      console.error(`${S.gray}    Gõ ${S.reset}ai-kit help${S.gray} để xem danh sách lệnh.${S.reset}`);
    }
    process.exit(1);
  }
}

// bgUpdateCheck — non-blocking, runs after every command except meta commands
if (!['help', 'version', 'install', undefined].includes(resolved)) bgUpdateCheck();
