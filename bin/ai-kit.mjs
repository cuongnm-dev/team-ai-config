#!/usr/bin/env node
// ai-kit — Team AI config manager (Node.js + Ink TUI)
// One file MVP. Split into modules later as it grows.

import React, {useState, useEffect} from 'react';
import {render, Box, Text, Newline, useApp, Static} from 'ink';
import Spinner from 'ink-spinner';
import {execa, execaSync} from 'execa';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import {marked} from 'marked';
import {markedTerminal} from 'marked-terminal';

const VERSION = '0.2.0';
const AI_KIT_HOME = process.env.AI_KIT_HOME || path.join(os.homedir(), '.ai-kit');
const REPO_DIR = path.join(AI_KIT_HOME, 'team-ai-config');
const BIN_DIR = path.join(AI_KIT_HOME, 'bin');

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
// Override heading + code renderers using marked's new {tokens,depth} API
marked.use({
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
    console.error(`\x1b[31m  ✗ team-ai-config not found at ${REPO_DIR}\x1b[0m`);
    console.error(`\x1b[31m  ✗ Run bootstrap: irm .../bootstrap.ps1 | iex (Windows) or curl ... | bash (Mac/Linux)\x1b[0m`);
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
    h(Text, {bold: true, color: T.primary}, title)
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
    h(Row, {label: 'list-backups', value: 'List ai-config-backup-*'}),
    h(Row, {label: 'rollback [N]', value: 'Restore from backup (default newest)'}),
    h(Row, {label: 'clean [--keep N]', value: 'Delete old backups + docker prune'})
  ),
  h(Section, {title: 'Maintainer'},
    h(Row, {label: 'pack', value: 'Snapshot ~/ → repo'}),
    h(Row, {label: 'publish "<msg>"', value: 'pack + git commit + push'}),
    h(Row, {label: 'diff', value: 'Show local vs repo deltas'}),
    h(Row, {label: 'edit', value: 'Open repo in $EDITOR'})
  ),
  h(Section, {title: 'Misc'},
    h(Row, {label: 'reset', value: 'Discard local repo edits + pull'}),
    h(Row, {label: 'uninstall', value: 'Remove ~/.ai-kit (keeps deployed)'})
  ),
  h(Box, {marginTop: 1}, h(Text, {color: T.dim}, `Layout: ${AI_KIT_HOME}`))
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

const Status = () => {
  const [mcpStatus, setMcpStatus] = useState({state: 'checking', healthz: 'checking'});
  const {exit} = useApp();
  ensureRepo();

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

  const sha = gitOut('rev-parse', '--short', 'HEAD');
  const date = gitOut('log', '-1', '--format=%cd', '--date=short');
  const msg = gitOut('log', '-1', '--format=%s');

  const countDir = (p, filter) => {
    if (!exists(p)) return 0;
    return fs.readdirSync(p, {withFileTypes: true}).filter(filter).length;
  };
  const claudeAgents = countDir(path.join(os.homedir(), '.claude', 'agents'), e => e.isFile() && e.name.endsWith('.md'));
  const claudeSkills = countDir(path.join(os.homedir(), '.claude', 'skills'), e => e.isDirectory());
  const cursorAgents = countDir(path.join(os.homedir(), '.cursor', 'agents'), e => e.isFile() && e.name.endsWith('.md'));
  const cursorSkills = countDir(path.join(os.homedir(), '.cursor', 'skills'), e => e.isDirectory());

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

const Doctor = () => {
  ensureRepo();
  const checks = [
    {name: 'git', required: true, ok: cmdAvail('git')},
    {name: 'docker', required: true, ok: cmdAvail('docker')},
    {name: 'node', required: true, ok: cmdAvail('node')},
    {name: 'curl', required: false, ok: cmdAvail('curl')},
    {name: 'glow (markdown render)', required: false, ok: cmdAvail('glow')},
    {name: 'bat (alt renderer)', required: false, ok: cmdAvail('bat')},
  ];
  let dockerDaemon = false;
  try { execaSync('docker', ['info'], {stdio: 'ignore'}); dockerDaemon = true; } catch {}
  const repoOk = exists(path.join(REPO_DIR, '.git'));
  const pathOk = (process.env.PATH || '').split(path.delimiter).includes(BIN_DIR);

  const allRequiredOk = checks.filter(c => c.required).every(c => c.ok) && dockerDaemon && repoOk;

  return h(Box, {flexDirection: 'column', padding: 1},
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
};

const renderDoc = (file) => {
  const content = fs.readFileSync(file, 'utf8');
  const stripped = stripFm(content);
  // Skip glow for docs with wide ASCII art — glow wraps box-drawing → vỡ diagram
  const hasWideAsciiArt = stripped.split('\n').some(line =>
    line.length > 70 && /[┌┐└┘─│├┤┬┴┼►◄▼▲]/.test(line)
  );
  if (cmdAvail('glow') && !hasWideAsciiArt) {
    // Windows lacks 'less' for -p paging; let terminal handle scrolling natively
    const glowArgs = process.platform === 'win32' ? [file] : ['-p', file];
    try { execaSync('glow', glowArgs, {stdio: 'inherit'}); return; } catch {}
  }
  const w = _cols();
  const bar = '─'.repeat(w - 4);
  const relPath = path.relative(REPO_DIR, file);
  const titleM = content.match(/^title:\s*(.+)$/m);
  const docTitle = titleM ? titleM[1].replace(/^["']|["']$/g, '') : path.basename(file, '.md');
  const out = process.stdout;
  out.write('\n');
  out.write(`  \x1b[2m${relPath}\x1b[0m\n`);
  out.write(`  \x1b[2m${bar}\x1b[0m\n\n`);
  out.write(marked.parse(stripped).trimEnd());
  out.write('\n\n');
  out.write(`  \x1b[2m${bar}\x1b[0m\n`);
  out.write(`  \x1b[90mai-kit doc  ·  ai-kit doc --search <term>\x1b[0m\n\n`);
};


// ─── Plain-stdout doc renderers (no Ink — avoids ANSI-stripping + wrap bugs) ──

const S = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', bcyan: '\x1b[1;36m',
  magenta: '\x1b[35m', bmagenta: '\x1b[1;35m',
  gray: '\x1b[90m', white: '\x1b[97m',
};

const printDivider = (title, count) => {
  const w = _cols();
  const label = count != null ? `${title} (${count})` : title;
  const lineLen = Math.max(2, w - label.length - 9);
  process.stdout.write(`\n${S.gray}  ── ${S.reset}${S.bmagenta}${label}${S.reset} ${S.gray}${'─'.repeat(lineLen)}${S.reset}\n`);
};

const printItem = (name, title, nameWidth = 24) => {
  const n = name.padEnd(nameWidth);
  process.stdout.write(`  ${S.gray}›${S.reset} ${S.cyan}${n}${S.reset}  ${S.gray}${title || ''}${S.reset}\n`);
};

const readDocItems = (dir) => {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const c = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = c.match(/^title:\s*(.+)$/m);
    return {name: f.replace(/\.md$/, ''), title: m ? m[1].replace(/^["']|["']$/g, '') : f};
  });
};

const printDocsIndex = () => {
  ensureRepo();
  const docsDir = path.join(REPO_DIR, 'docs');
  const root = readDocItems(docsDir).filter(it => it.name !== 'README');
  const workflows = readDocItems(path.join(docsDir, 'workflows'));
  const reference = readDocItems(path.join(docsDir, 'reference'));
  const out = process.stdout;
  out.write(`\n${S.bcyan}  Documentation Hub${S.reset}\n`);
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
  out.write(`\n${S.bcyan}  Skills Catalog${S.reset}\n`);
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
  out.write(`\n${S.bcyan}  Agents Catalog${S.reset}\n`);
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
  const flag = args[1];

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
    out.write(`\n  \x1b[1;36mSearch results\x1b[0m  \x1b[90m"${term}"  ·  ${results.length} hit${results.length !== 1 ? 's' : ''}\x1b[0m\n`);
    out.write(`  \x1b[2m${bar}\x1b[0m\n\n`);
    let lastFile = '';
    results.forEach(r => {
      if (r.path !== lastFile) {
        if (lastFile) out.write('\n');
        out.write(`  \x1b[35m${r.path}\x1b[0m\n`);
        lastFile = r.path;
      }
      out.write(`  \x1b[90m:${String(r.line).padStart(4)}\x1b[0m  ${r.text}\n`);
    });
    out.write(`\n  \x1b[2m${bar}\x1b[0m\n\n`);
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
    process.stderr.write(`\x1b[31m  ✗ Topic not found: ${sub}\x1b[0m\n`);
    printDocsIndex();
    process.exit(1);
  }
  renderDoc(file);
};

// ─── Imperative commands (side-effect heavy) ──────────────────────────
// Use plain console.log + chalk-style ANSI. No Ink overhead.

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', gray: '\x1b[90m',
};
const info = m => console.log(`${C.bold}${C.cyan}▶${C.reset} ${m}`);
const ok   = m => console.log(`  ${C.green}✓${C.reset} ${m}`);
const warn = m => console.log(`  ${C.yellow}⚠${C.reset} ${m}`);
const err  = m => console.error(`  ${C.red}✗${C.reset} ${m}`);

const sh = (cmd, args, opts = {}) => execaSync(cmd, args, {stdio: 'inherit', reject: false, ...opts});
const shQuiet = (cmd, args, opts = {}) => execaSync(cmd, args, {stdio: ['ignore', 'pipe', 'pipe'], reject: false, ...opts});

const composeDir = () => path.join(REPO_DIR, 'mcp', 'etc-platform');
const composeCmd = (...args) => sh('docker', ['compose', ...args], {cwd: composeDir()});

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
  for (const f of ['ai-kit', 'ai-kit.cmd', 'ai-kit.ps1', 'ai-kit.mjs', 'ai-kit.legacy', 'ai-kit.legacy.ps1']) {
    const src = path.join(REPO_DIR, 'bin', f);
    const dst = path.join(BIN_DIR, f);
    if (exists(src)) {
      fs.mkdirSync(BIN_DIR, {recursive: true});
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
    const npmResult = sh(npmBin, ['install', '--omit=dev', '--silent'], {cwd: AI_KIT_HOME});
    if (npmResult.exitCode !== 0) { err('npm install failed'); process.exit(1); }
  }

  // Deploy configs to ~/.claude + ~/.cursor (simple rsync/copy)
  info('Deploying agents + skills to ~/.claude and ~/.cursor');
  const deploy = (subdir, target) => {
    const src = path.join(REPO_DIR, subdir);
    if (!exists(src)) return;
    const dst = path.join(os.homedir(), target);
    fs.mkdirSync(dst, {recursive: true});
    if (cmdAvail('rsync')) {
      sh('rsync', ['-a', '--delete', src + '/', dst + '/']);
    } else {
      // Node fallback recursive copy
      const cpr = (s, d) => {
        if (!exists(s)) return;
        fs.mkdirSync(d, {recursive: true});
        for (const e of fs.readdirSync(s, {withFileTypes: true})) {
          const sp = path.join(s, e.name), dp = path.join(d, e.name);
          if (e.isDirectory()) cpr(sp, dp);
          else fs.copyFileSync(sp, dp);
        }
      };
      cpr(src, dst);
    }
  };
  deploy('claude/agents', '.claude/agents');
  deploy('claude/skills', '.claude/skills');
  deploy('cursor/agents', '.cursor/agents');
  deploy('cursor/skills', '.cursor/skills');
  ok('Configs deployed');

  // MCP refresh
  if (exists(composeDir())) {
    info('Refreshing MCP image (pull + restart)');
    composeCmd('pull');
    composeCmd('up', '-d', '--force-recreate');
    ok('MCP refreshed');
  }
  ok('Update complete');
};

// ─── mcp <verb> ────────────────────────────────────────────────────────
const cmdMcp = (args) => {
  ensureRepo();
  const verb = args[0] || 'status';
  if (!exists(composeDir())) { err(`MCP folder not found: ${composeDir()}`); process.exit(1); }
  switch (verb) {
    case 'start':   info('docker compose up -d'); composeCmd('up', '-d'); break;
    case 'stop':    info('docker compose down'); composeCmd('down'); break;
    case 'restart': info('docker compose restart'); composeCmd('restart'); break;
    case 'logs':    composeCmd('logs', '-f', '--tail=200'); break;
    case 'pull':    info('docker compose pull'); composeCmd('pull'); break;
    case 'status':  composeCmd('ps'); break;
    default:        err(`Unknown mcp verb: ${verb}. Use: start|stop|restart|logs|pull|status`); process.exit(1);
  }
};

// ─── logs ──────────────────────────────────────────────────────────────
const cmdLogs = () => cmdMcp(['logs']);

// ─── reset ─────────────────────────────────────────────────────────────
const cmdReset = () => {
  ensureRepo();
  info(`Resetting ${REPO_DIR} to clean HEAD`);
  sh('git', ['-C', REPO_DIR, 'status', '--short']);
  sh('git', ['-C', REPO_DIR, 'reset', '--hard', 'HEAD']);
  sh('git', ['-C', REPO_DIR, 'clean', '-fd']);
  sh('git', ['-C', REPO_DIR, 'pull', '--ff-only', '--quiet']);
  ok('Repo reset + pulled');
};

// ─── list-backups / rollback / clean ──────────────────────────────────
const listBackupDirs = () => {
  const home = os.homedir();
  const out = [];
  for (const sub of ['.claude', '.cursor']) {
    const root = path.join(home, sub);
    if (!exists(root)) continue;
    for (const e of fs.readdirSync(root, {withFileTypes: true})) {
      if (e.isDirectory() && /^ai-config-backup-/.test(e.name)) {
        out.push(path.join(root, e.name));
      }
    }
  }
  return out.sort();
};
const cmdListBackups = () => {
  const backs = listBackupDirs();
  if (!backs.length) { console.log('  (no backups)'); return; }
  backs.forEach(b => console.log(`  ${b}`));
};
const cmdRollback = (args) => {
  const n = args[0] ? parseInt(args[0], 10) : null;
  const backs = listBackupDirs();
  if (!backs.length) { err('No backups found'); process.exit(1); }
  const target = n != null ? backs[n] : backs[backs.length - 1];
  if (!target) { err(`No backup at index ${n}`); process.exit(1); }
  info(`Restoring from ${target}`);
  warn('Manual restore: copy contents of backup over deployed dir.');
  console.log(`  Suggested: cp -r "${target}/." ~/.claude/  (review first!)`);
};
const cmdClean = (args) => {
  const keepIdx = args.indexOf('--keep');
  const keep = keepIdx >= 0 ? parseInt(args[keepIdx + 1], 10) : 3;
  const backs = listBackupDirs();
  if (backs.length <= keep) { ok(`Nothing to delete (have ${backs.length}, keep ${keep})`); }
  else {
    const drop = backs.slice(0, backs.length - keep);
    drop.forEach(b => { info(`rm -rf ${b}`); fs.rmSync(b, {recursive: true, force: true}); });
    ok(`Deleted ${drop.length} backups`);
  }
  info('docker system prune -f');
  sh('docker', ['system', 'prune', '-f']);
};

// ─── pack / publish / diff / edit (maintainer) ────────────────────────
const cmdPack = () => {
  ensureRepo();
  info('Snapshot ~/.claude + ~/.cursor → repo');
  const copy = (src, dst) => {
    if (!exists(src)) return;
    fs.mkdirSync(dst, {recursive: true});
    if (cmdAvail('rsync')) sh('rsync', ['-a', '--delete', src + '/', dst + '/']);
    else { sh('cp', ['-R', src + '/.', dst + '/']); }
  };
  copy(path.join(os.homedir(), '.claude', 'agents'),  path.join(REPO_DIR, 'claude', 'agents'));
  copy(path.join(os.homedir(), '.claude', 'skills'),  path.join(REPO_DIR, 'claude', 'skills'));
  copy(path.join(os.homedir(), '.cursor', 'agents'),  path.join(REPO_DIR, 'cursor', 'agents'));
  copy(path.join(os.homedir(), '.cursor', 'skills'),  path.join(REPO_DIR, 'cursor', 'skills'));
  ok('Packed');
  sh('git', ['-C', REPO_DIR, 'status', '--short']);
};
const cmdPublish = (args) => {
  const msg = args.join(' ').trim();
  if (!msg) { err('Usage: ai-kit publish "<commit message>"'); process.exit(1); }
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
const cmdUninstall = () => {
  warn(`This removes ${AI_KIT_HOME} (CLI + repo). Deployed ~/.claude + ~/.cursor stay.`);
  console.log('  Confirm by setting AI_KIT_CONFIRM=1 and re-running.');
  if (process.env.AI_KIT_CONFIRM !== '1') process.exit(1);
  fs.rmSync(AI_KIT_HOME, {recursive: true, force: true});
  ok('Removed');
};

// ─── install (alias for bootstrap message) ────────────────────────────
const cmdInstall = () => {
  info('First-time install: use bootstrap one-liner.');
  console.log('  macOS/Linux: curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash');
  console.log('  Windows:     irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex');
};

// ─── Dispatch ──────────────────────────────────────────────────────────
const cmd = process.argv[2];
const args = process.argv.slice(3);

const aliasMap = {
  '-v': 'version', '--version': 'version',
  '-h': 'help', '--help': 'help',
  'up': 'update', 'st': 'status', 'dr': 'doctor', 'doc': 'docs',
};
const resolved = aliasMap[cmd] || cmd || 'help';

switch (resolved) {
  case 'help':
    renderStaticLater(h(Help));
    break;
  case 'version':
    renderStaticLater(h(Version));
    break;
  case 'status':
    render(h(Status));   // self-exits via useApp
    break;
  case 'doctor':
    renderStaticLater(h(Doctor));
    break;
  case 'docs':
    docCommand(args);
    break;
  case 'update':       cmdUpdate(); break;
  case 'mcp':          cmdMcp(args); break;
  case 'logs':         cmdLogs(); break;
  case 'reset':        cmdReset(); break;
  case 'list-backups': cmdListBackups(); break;
  case 'rollback':     cmdRollback(args); break;
  case 'clean':        cmdClean(args); break;
  case 'pack':         cmdPack(); break;
  case 'publish':      cmdPublish(args); break;
  case 'diff':         cmdDiff(); break;
  case 'edit':         cmdEdit(); break;
  case 'uninstall':    cmdUninstall(); break;
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
