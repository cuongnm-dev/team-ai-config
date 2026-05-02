#!/usr/bin/env node
// ai-kit — Team AI config manager (Node.js + Ink TUI)
// One file MVP. Split into modules later as it grows.

import { execa, execaSync } from 'execa';
import { Box, render, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { marked } from 'marked';
import { markedTerminal } from 'marked-terminal';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React, { useEffect, useState } from 'react';

const _pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const VERSION = _pkg.version;
const AI_KIT_HOME = process.env.AI_KIT_HOME || path.join(os.homedir(), '.ai-kit');
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
    h(Row, {label: 'version | -v', value: 'Show ai-kit + team-config + MCP versions'})
  ),
  h(Section, {title: 'Documentation'},
    h(Row, {label: 'doc', value: 'Show docs index'}),
    h(Row, {label: 'doc <topic>', value: 'Render specific doc page'}),
    h(Row, {label: 'doc skills', value: 'Skills catalog (curated)'}),
    h(Row, {label: 'doc agents', value: 'Agents catalog (curated)'}),
    h(Row, {label: 'doc --search <t>', value: 'Search across docs + agents + skills'})
  ),
  h(Section, {title: 'MCP control'},
    h(Row, {label: 'mcp <verb>', value: 'start | stop | restart | logs | pull | status'})
  ),
  h(Section, {title: 'Backups'},
    h(Row, {label: 'list-backups', value: 'List ai-config-backup-* (created on every update)'}),
    h(Row, {label: 'rollback [N]', value: 'Restore from backup (default newest); auto-snapshots before'}),
    h(Row, {label: 'clean [--keep N] --yes', value: 'Delete old backups + scoped docker image prune'})
  ),
  h(Section, {title: 'Maintainer'},
    h(Row, {label: 'pack', value: 'Snapshot ~/ → repo'}),
    h(Row, {label: 'publish "<msg>"', value: 'pack + git commit + push'}),
    h(Row, {label: 'diff', value: 'Show local vs repo deltas'}),
    h(Row, {label: 'edit', value: 'Open repo in $EDITOR'})
  ),
  h(Section, {title: 'Misc'},
    h(Row, {label: 'upgrade | upg', value: 'npm update Node.js deps in ~/.ai-kit'}),
    h(Row, {label: 'reset [--yes]', value: 'Discard local repo edits + pull'}),
    h(Row, {label: 'uninstall [--yes]', value: 'Remove ~/.ai-kit (keeps deployed)'})
  ),
  h(Section, {title: 'Global flags'},
    h(Row, {label: '--quiet | -q', value: 'Suppress info/ok output (CI-friendly)'}),
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
  const checks = [
    {name: 'git', required: true, ok: cmdAvail('git')},
    {name: 'docker', required: true, ok: cmdAvail('docker')},
    {name: `node ≥18 (found: ${nodeVersion || 'none'})`, required: true, ok: nodeMajor >= 18},
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
    h(Section, {title: 'Optional (prettier output)'},
      ...checks.filter(c => !c.required).map(c =>
        c.ok ? h(Ok, null, c.name) : h(Warn, null, `${c.name} — install for richer output`)
      )
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
    if (!args[1]) { console.error('Usage: ai-kit doc --search <term>'); process.exit(1); }
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

// Print friendly OS-specific guidance when Docker missing/stopped.
const printDockerGuide = (state) => {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  warn(state === 'not-installed'
    ? 'Docker chưa được cài đặt trên máy.'
    : 'Docker daemon đang dừng — service MCP cần Docker để chạy.');
  console.log('');
  if (state === 'not-installed') {
    if (isWin) {
      console.log(`  ${C.cyan}Cài Docker Desktop cho Windows:${C.reset}`);
      console.log('    1. Tải:  https://www.docker.com/products/docker-desktop/');
      console.log('    2. Hoặc qua winget:  winget install Docker.DockerDesktop');
      console.log('    3. Sau khi cài, mở Docker Desktop và đợi icon Docker xanh ở taskbar.');
    } else if (isMac) {
      console.log(`  ${C.cyan}Cài Docker Desktop cho macOS:${C.reset}`);
      console.log('    1. Tải:  https://www.docker.com/products/docker-desktop/');
      console.log('    2. Hoặc qua brew:  brew install --cask docker');
      console.log('    3. Sau khi cài, mở Docker Desktop từ Applications.');
    } else {
      console.log(`  ${C.cyan}Cài Docker Engine cho Linux:${C.reset}`);
      console.log('    curl -fsSL https://get.docker.com | sh');
      console.log('    sudo usermod -aG docker $USER  # logout/login để áp dụng');
      console.log('    sudo systemctl enable --now docker');
    }
  } else {
    if (isWin) {
      console.log(`  ${C.cyan}Bật Docker Desktop:${C.reset}`);
      console.log('    1. Mở Start menu → tìm "Docker Desktop" → Run');
      console.log('    2. Đợi icon Docker xanh ở taskbar (~30s)');
      console.log('    3. Hoặc CLI:  Start-Process "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"');
    } else if (isMac) {
      console.log(`  ${C.cyan}Bật Docker Desktop:${C.reset}`);
      console.log('    open -a Docker');
      console.log('    # Đợi icon Docker xuất hiện trên menu bar (~30s)');
    } else {
      console.log(`  ${C.cyan}Bật Docker daemon:${C.reset}`);
      console.log('    sudo systemctl start docker');
      console.log('    sudo systemctl enable docker  # tự động bật khi reboot');
    }
  }
  console.log('');
  console.log(`  ${C.gray}Sau khi xong, chạy lại:${C.reset}  ai-kit update`);
  console.log('');
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
const cmdUpdate = () => {
  ensureRepo();
  info('Checking for local changes');
  const {stdout: dirty} = shQuiet('git', ['-C', REPO_DIR, 'status', '--porcelain']);
  if (dirty && dirty.trim()) {
    err('Local changes detected. Run "ai-kit reset" to discard, or commit first.');
    console.log(dirty);
    process.exit(1);
  }
  info('Pulling latest team-ai-config');
  const r = sh('git', ['-C', REPO_DIR, 'pull', '--ff-only', '--quiet']);
  if (r.exitCode !== 0) { err('git pull failed'); process.exit(1); }
  ok('Repo updated');

  // Refresh CLI itself
  info('Refreshing ai-kit CLI in ~/.ai-kit/bin');
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
  ok('CLI refreshed');

  // Install Node deps into AI_KIT_HOME so ESM resolution from bin/ finds them
  const pkgSrc = path.join(REPO_DIR, 'package.json');
  if (exists(pkgSrc)) {
    info('Installing Node deps into ~/.ai-kit');
    fs.copyFileSync(pkgSrc, path.join(AI_KIT_HOME, 'package.json'));
    const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const npmArgs = ['install', '--omit=dev'];
    if (QUIET) npmArgs.push('--silent');
    const npmResult = sh(npmBin, npmArgs, {cwd: AI_KIT_HOME});
    if (npmResult.exitCode !== 0) { err('npm install failed'); process.exit(1); }
  }

  // Snapshot current live configs before overwriting → enables ai-kit rollback
  info('Snapshotting current configs');
  const _snapTs = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const _snapName = `ai-config-backup-${_snapTs}`;
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
  ok(`Configs backed up (${_snapName}) — restore with: ai-kit rollback`);

  // Deploy configs to ~/.claude + ~/.cursor — atomic: write to .tmp then swap
  info('Deploying agents + skills to ~/.claude and ~/.cursor');
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
    // Atomic swap: remove old, rename tmp into place
    if (exists(dst)) fs.rmSync(dst, {recursive: true, force: true});
    fs.renameSync(dstTmp, dst);
  };
  deploy('claude/agents', '.claude/agents');
  deploy('claude/skills', '.claude/skills');
  deploy('cursor/agents', '.cursor/agents');
  deploy('cursor/skills', '.cursor/skills');
  ok('Configs deployed');

  // MCP refresh — needs Docker. Friendly guidance + best-effort auto-start.
  if (exists(composeDir())) {
    info('Refreshing MCP image (pull + restart)');
    let state = dockerHealth();
    if (state === 'not-running') {
      warn('Docker daemon không phản hồi — đang thử khởi động tự động…');
      if (tryStartDocker() && waitForDocker(60000)) {
        ok('Docker đã sẵn sàng');
        state = 'ok';
      } else {
        state = 'not-running';
      }
    }
    if (state === 'ok') {
      composeCmd('pull');
      composeCmd('up', '-d', '--force-recreate');
      ok('MCP refreshed');
    } else {
      printDockerGuide(state);
      warn('Bỏ qua bước refresh MCP. Repo + agents/skills đã cập nhật.');
    }
  }

  // Reset update-check cache so next invocation does not show stale "X behind" notice.
  // Background refresher will re-poll origin within 1h; until then, mark as up-to-date.
  try {
    fs.mkdirSync(AI_KIT_HOME, {recursive: true});
    fs.writeFileSync(UPDATE_CACHE, JSON.stringify({ahead: 0, ts: Date.now()}));
  } catch {}

  ok('Update complete');
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
  if (!dirty) { ok('Repo already clean — nothing to reset'); return; }
  if (!yes) {
    warn('Will discard all local changes (git reset --hard + git clean -fd):');
    dirty.split('\n').forEach(l => console.log(`    ${C.gray}${l}${C.reset}`));
    warn('Re-run with --yes / -y to confirm: ai-kit reset --yes');
    process.exit(0);
  }
  info(`Resetting ${REPO_DIR} to clean HEAD`);
  sh('git', ['-C', REPO_DIR, 'reset', '--hard', 'HEAD']);
  sh('git', ['-C', REPO_DIR, 'clean', '-fd']);
  sh('git', ['-C', REPO_DIR, 'pull', '--ff-only', '--quiet']);
  ok('Repo reset + pulled');
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
  if (!snaps.length) { err('No backups found'); process.exit(1); }
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
    warn('Re-run with --yes / -y to confirm.');
    process.exit(0);
  }
  toDrop.forEach(s => {
    info(`Removing ${s.name}`);
    s.dirs.forEach(d => fs.rmSync(d, {recursive: true, force: true}));
  });
  ok(`Deleted ${toDrop.length} snapshot(s)`);
  info('Pruning dangling Docker images (scoped to etc-platform)');
  sh('docker', ['image', 'prune', '-f', '--filter', 'label=com.docker.compose.project=etc-platform']);
  ok('Clean complete');
};

// ─── upgrade (npm update) ─────────────────────────────────────────────
const cmdUpgrade = () => {
  ensureRepo();
  info('Updating Node.js deps in ~/.ai-kit (npm update)');
  const pkgSrc = path.join(REPO_DIR, 'package.json');
  if (!exists(pkgSrc)) { err('package.json not found'); process.exit(1); }
  fs.copyFileSync(pkgSrc, path.join(AI_KIT_HOME, 'package.json'));
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = sh(npmBin, ['update', '--omit=dev', ...(QUIET ? ['--silent'] : [])], {cwd: AI_KIT_HOME});
  if (r.exitCode !== 0) { err('npm update failed'); process.exit(1); }
  ok('Deps upgraded');
};

// ─── pack / publish / diff / edit (maintainer) ────────────────────────
const cmdPack = () => {
  ensureRepo();
  info('Snapshot ~/.claude + ~/.cursor → repo');
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
  ok('Packed');
  sh('git', ['-C', REPO_DIR, 'status', '--short']);
};
const cmdPublish = (args) => {
  ensureRepo();
  const msg = args.join(' ').trim();
  if (!msg) { err('Usage: ai-kit publish "<commit message>"'); process.exit(1); }
  // Fast-fail: verify remote reachable before any side-effectful pack
  info('Checking git remote reachability');
  const lsr = sh('git', ['-C', REPO_DIR, 'ls-remote', '--exit-code', 'origin', 'HEAD'], {stdio: ['ignore', 'ignore', 'inherit']});
  if (lsr.exitCode !== 0) { err('Cannot reach git remote — check credentials/network'); process.exit(1); }
  cmdPack();
  sh('git', ['-C', REPO_DIR, 'add', '-A']);
  const r = sh('git', ['-C', REPO_DIR, 'commit', '-m', msg]);
  if (r.exitCode !== 0) { warn('Nothing to commit'); return; }
  sh('git', ['-C', REPO_DIR, 'push']);
  ok('Published');
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
    warn('Re-run with --yes / -y to confirm: ai-kit uninstall --yes');
    process.exit(0);
  }
  fs.rmSync(AI_KIT_HOME, {recursive: true, force: true});
  ok('Removed');
};

// ─── install (alias for bootstrap message) ────────────────────────────
const cmdInstall = () => {
  info('First-time install: use bootstrap one-liner.');
  console.log('  macOS/Linux: curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash');
  console.log('  Windows:     irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex');
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
};
const cmdHelp = (topic) => {
  const resolved = ({up:'update',st:'status',dr:'doctor',upg:'upgrade'})[topic] || topic;
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

// ─── Dispatch ──────────────────────────────────────────────────────────
const cmd = _rawArgs[0];
const args = _rawArgs.slice(1);

const aliasMap = {
  '-v': 'version', '--version': 'version',
  '-h': 'help', '--help': 'help',
  'up': 'update', 'st': 'status', 'dr': 'doctor', 'doc': 'docs',
  'upg': 'upgrade',
};
const resolved = aliasMap[cmd] || cmd || 'help';

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
  case 'pack':         cmdPack(); break;
  case 'publish':      cmdPublish(args); break;
  case 'diff':         cmdDiff(); break;
  case 'edit':         cmdEdit(); break;
  case 'uninstall':    cmdUninstall(args); break;
  case 'install':      cmdInstall(); break;
  default: {
    // Last-resort fallback to legacy shell (should rarely fire now)
    const isWin = process.platform === 'win32';
    const legacy = path.join(REPO_DIR, 'bin', isWin ? 'ai-kit.legacy.ps1' : 'ai-kit.legacy');
    if (exists(legacy)) {
      const child = isWin
        ? execaSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', legacy, cmd, ...args], {stdio: 'inherit', reject: false})
        : execaSync('bash', [legacy, cmd, ...args], {stdio: 'inherit', reject: false});
      process.exit(child.exitCode || 0);
    }
    console.error(`${C.red}  ✗ Unknown command: ${cmd}${C.reset}`);
    renderStaticLater(h(Help));
    process.exit(1);
  }
}

// bgUpdateCheck — non-blocking, runs after every command except meta commands
if (!['help', 'version', 'install', undefined].includes(resolved)) bgUpdateCheck();
