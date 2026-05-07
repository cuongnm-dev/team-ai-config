// ai-kit SDLC subcommand dispatcher.
//
// Routes `ai-kit sdlc <subcommand> [flags]` to corresponding *_impl function.
// Output: JSON to stdout (machine-parseable, mirrors prior MCP response shape).
// Exit code: 0 if result.ok else 1.

import { sdlcCallAsync, SdlcError } from './errors.mjs';

// ─── Flag parser ───
//
// Supported syntax:
//   --key value        (string)
//   --key=value        (string, equals form)
//   --flag             (boolean true)
//   --no-flag          (boolean false)
//   positional args    (collected separately)

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const stripped = a.slice(2);
      const eqIdx = stripped.indexOf('=');
      if (eqIdx !== -1) {
        flags[stripped.slice(0, eqIdx)] = stripped.slice(eqIdx + 1);
      } else if (stripped.startsWith('no-')) {
        flags[stripped.slice(3)] = false;
      } else {
        // Lookahead: next token a value (not starting with --) → string flag; else boolean
        const next = argv[i + 1];
        if (next != null && !next.startsWith('--')) {
          flags[stripped] = next;
          i++;
        } else {
          flags[stripped] = true;
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

// ─── Helpers ───

const csv = (v) => v == null ? null : String(v).split(',').map(s => s.trim()).filter(Boolean);
const jsonOrNull = (v) => v == null ? null : JSON.parse(String(v));
const intOrNull = (v) => (v == null || v === '') ? null : parseInt(v, 10);
// Parse --stages flag: null | 'auto' | string[]. Empty/missing → null (no pre-create).
const parseStagesFlag = (v) => {
  if (v == null || v === '') return null;
  if (String(v).trim() === 'auto') return 'auto';
  return csv(v) || [];
};
const bool = (v, def = false) => {
  if (v === undefined) return def;
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return Boolean(v);
};

function emit(result) {
  // JSON to stdout, exit code per ok
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exit(result && result.ok ? 0 : 1);
}

// LLM-friendly error decoration (audit 2026-05-07): every error response includes
// `help_command` pointing to the right --help so LLM doesn't need to read source.
// Caller passes helpCommand string (e.g. "ai-kit sdlc scaffold module --help");
// emitFromCall injects it into error.help_command for SdlcError + internal errors.
async function emitFromCall(fn, helpCommand = null) {
  try {
    const result = await fn();
    emit(result);
  } catch (err) {
    if (err instanceof SdlcError) {
      const resp = err.toResponse();
      if (helpCommand && resp && resp.error) {
        resp.error.help_command = helpCommand;
      }
      emit(resp);
    } else {
      // Unexpected — write to stderr, JSON shape to stdout for caller, exit 2
      process.stderr.write(`ai-kit sdlc internal error: ${err.stack || err.message}\n`);
      const internalResp = {
        ok: false,
        error: { code: 'MCP_E_INTERNAL', message: err.message, details: { stack: err.stack } },
      };
      if (helpCommand) internalResp.error.help_command = helpCommand;
      process.stdout.write(JSON.stringify(internalResp) + '\n');
      process.exit(2);
    }
  }
}

// ─── Main dispatcher ───

export async function runSdlcCli(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    return;
  }

  const subcommand = argv[0];
  const rest = argv.slice(1);

  switch (subcommand) {
    case 'resolve':           return await dispatchResolve(rest);
    case 'verify':            return await dispatchVerify(rest);
    case 'autofix':           return await dispatchAutofix(rest);
    case 'template-registry': return await dispatchTemplateRegistry(rest);
    case 'scaffold':          return await dispatchScaffold(rest);
    case 'refactor':          return await dispatchRefactor(rest);
    case 'state':             return await dispatchState(rest);
    default:
      process.stderr.write(`Unknown sdlc subcommand: ${subcommand}\n`);
      printHelp();
      process.exit(2);
  }
}

function printHelp() {
  process.stderr.write(`Usage: ai-kit sdlc <subcommand> [flags]

Subcommands:
  resolve            Map-based path resolution (replaces glob fallback)
  verify             Read-only structural integrity check (8 scopes)
  autofix            Repair structure violations with safeguards
  template-registry  Templates list/load
  scaffold           Atomic SDLC scaffolding (workspace/module/feature/hotfix/app-or-service)
  refactor           Refactor operations (rename-module-slug)
  state              State mutations on _state.md / _feature.md / catalog files

Run 'ai-kit sdlc <subcommand> --help' for per-command flags.
`);
}

// ─── Subcommand handlers ───

async function dispatchResolve(argv) {
  const { flags } = parseFlags(argv);
  const { resolvePathImpl } = await import('./resolve.mjs');
  await emitFromCall(() => resolvePathImpl(
    flags.workspace || flags.w,
    flags.kind,
    flags.id,
    bool(flags['include-metadata'], false),
  ));
}

async function dispatchVerify(argv) {
  const { flags } = parseFlags(argv);
  const { verifyImpl } = await import('./verify.mjs');
  await emitFromCall(() => verifyImpl(
    flags.workspace || flags.w,
    csv(flags.scopes) || [],
    {
      strict_mode: flags.strict || 'warn',
      context: jsonOrNull(flags.context),
    },
  ));
}

async function dispatchAutofix(argv) {
  const { flags } = parseFlags(argv);
  const { autofixImpl } = await import('./repair.mjs');
  await emitFromCall(() => autofixImpl(
    flags.workspace || flags.w,
    csv(flags['fix-classes']) || [],
    {
      dry_run: bool(flags['dry-run'], true),
      confirm_destructive: bool(flags['confirm-destructive'], false),
    },
  ));
}

async function dispatchTemplateRegistry(argv) {
  const { flags } = parseFlags(argv);
  const { templateRegistryImpl } = await import('./template-registry.mjs');
  await emitFromCall(() => templateRegistryImpl(
    flags.namespace,
    flags.action,
    flags['template-id'] || null,
  ));
}

// ─── Scaffold help spec (single source of truth — keep in sync with dispatchScaffold flag wiring below) ───

const SCAFFOLD_HELP = {
  workspace: {
    summary: 'Scaffold a new workspace (mini single-project or mono multi-project) with intel layer + AGENTS.md/CLAUDE.md.',
    required: [
      ['--workspace, -w <path>', 'Workspace root path (e.g., ".")'],
      ['--type <mini|mono>',     'Workspace topology'],
    ],
    optional: [
      ['--stack <id>',           'Stack template (nodejs|python|go|rust|none, default: none)'],
      ['--config <json>',        'Extra config JSON blob'],
      ['--force',                'Overwrite existing files (default: false)'],
    ],
    example: 'ai-kit sdlc scaffold workspace --workspace . --type mono --stack nodejs',
  },
  'app-or-service': {
    summary: 'Add an app/service/lib/package project to a mono workspace.',
    required: [
      ['--workspace, -w <path>', 'Workspace root path'],
      ['--name <name>',          'Project name (kebab-case)'],
      ['--kind <kind>',          'app | service | lib | package'],
    ],
    optional: [
      ['--stack <id>',             'Stack template (default: none)'],
      ['--expected-version <int>', 'Expected workspace catalog version (optimistic lock)'],
    ],
    example: 'ai-kit sdlc scaffold app-or-service --workspace . --name iam-service --kind service --stack nodejs',
  },
  module: {
    summary: 'Atomically scaffold a module (M-NNN): writes _state.md + module-brief.md + implementations.yaml; updates module-catalog.json + module-map.yaml + _meta.json. Stage subdirs lazy by default (use --stages to control).',
    required: [
      ['--workspace, -w <path>', 'Absolute path to workspace root (must contain AGENTS.md or CLAUDE.md or docs/intel/)'],
      ['--id <M-NNN>',           'Module ID — exact regex ^M-\\d{3}$ (e.g. M-007). Must not collide with existing in module-catalog.'],
      ['--name <name>',          'Human-readable module name, min 3 chars (Vietnamese allowed, quote with spaces). E.g. "Logistics & Supply Chain"'],
      ['--slug <kebab>',         'URL-safe slug — regex ^[a-z][a-z0-9]*(-[a-z0-9]+)*$. E.g. "logistics-supply-chain". Drives folder name docs/modules/{id}-{slug}.'],
    ],
    optional: [
      ['--depends-on <csv>',          'Modules this depends on, csv of M-NNN. Each must exist in module-catalog. E.g. "M-001,M-003"'],
      ['--modules-in-scope <csv>',    'Sibling modules in same business scope (informational). Csv of M-NNN.'],
      ['--primary-service <name>',    'Primary backing service — kebab-case, ^[a-z][a-z0-9-]*$. Auto-populates implementations.yaml.services[0].path = services/{name}. E.g. "logistics-orchestrator". Forbidden: M-NNN-prefix patterns.'],
      ['--business-goal <text>',      'Free-text business goal, recommended >=50 chars. Quote when contains spaces.'],
      ['--risk-path <S|M|L>',         'Risk path enum exactly one of: S | M | L. Default: M. Drives stages_queue (S→4 stages, M→6, L→7).'],
      ['--output-mode <lean|full>',   'Output verbosity enum: lean | full. Default: lean.'],
      ['--agent-flags <json>',        'JSON object mapping agent name to trigger flags. E.g. \'{"designer":{"screen_count":5},"security":{"pii_found":true}}\'. Affects stages_queue + activeStageFoldersFor (when --stages auto).'],
      ['--expected-version <int>',    'Expected module-catalog.json version (optimistic lock). Read from docs/intel/_meta.json.artifacts."module-catalog.json".version. Mismatch → ERR_VERSION_CONFLICT.'],
      ['--stages <csv|auto>',         'Stage folders to pre-create. THREE modes: (a) omit → 0 folders (LAZY default — stage agents mkdir on first artifact write); (b) "auto" → derived from risk_path + agent_flags (4-7 folders, legacy); (c) csv of allowed names. Allowed: ba | sa | designer | security | tech-lead | dev | qa | reviewer.'],
    ],
    example: 'ai-kit sdlc scaffold module --workspace /abs/path --id M-007 --name "Logistics" --slug logistics --depends-on "M-001,M-003" --risk-path M --primary-service logistics-orchestrator --business-goal "Streamline last-mile delivery routing for taxpayer orders"',
  },
  feature: {
    summary: 'Atomically scaffold a feature (F-NNN) nested under parent module: writes _feature.md + implementations.yaml + test-evidence.json; updates feature-catalog.json + feature-map.yaml + module-catalog.json (parent.feature_ids[]). Stage subdirs lazy by default.',
    required: [
      ['--workspace, -w <path>', 'Absolute path to workspace root.'],
      ['--module <M-NNN>',       'Parent module ID — must exist in module-catalog (FK). Run scaffold module first if missing.'],
      ['--id <F-NNN>',           'Feature ID — regex ^F-\\d{3}[a-z]?$ (variant suffix optional, e.g. F-101 or F-101a). Must not collide.'],
      ['--name <name>',          'Human-readable feature name, min 3 chars (Vietnamese allowed). E.g. "OTP Login"'],
      ['--slug <kebab>',         'URL-safe slug — regex ^[a-z][a-z0-9]*(-[a-z0-9]+)*$. Drives folder docs/modules/{M-id}-*/_features/{F-id}-{slug}/.'],
    ],
    optional: [
      ['--description <text>',         'Free-text feature description (1-2 paragraphs).'],
      ['--business-intent <text>',     'Why this feature exists (recommended >=100 chars). Quote with spaces.'],
      ['--flow-summary <text>',        'Happy-path flow summary (recommended >=150 chars).'],
      ['--acceptance-criteria <json>', 'JSON array of AC strings. E.g. \'["User can log in with OTP","Failed OTP shows error after 3 tries"]\'. Empty array OK.'],
      ['--consumed-by <csv>',          'Cross-cutting: modules that consume this feature without owning it. Csv of M-NNN. Each must exist. Per CD-24, no duplicate feature folders across modules.'],
      ['--priority <p>',               'Enum exactly: critical | high | medium | low. Default: medium.'],
      ['--expected-version <int>',     'Expected module-catalog.json version (optimistic lock against parent module).'],
      ['--stages <csv|auto>',          'Stage folders to pre-create. THREE modes: (a) omit → 0 folders (LAZY default); (b) "auto" → both dev,qa; (c) csv subset. Allowed: dev | qa.'],
    ],
    note: 'Fields role_visibility, depends_on, expected_pipeline_path, references are NOT supported by scaffold flags; populate post-scaffold via `ai-kit sdlc state update --op field --kind feature --id F-NNN --field <name> --value <v>`. Run `ai-kit sdlc state update --help` for ops.',
    example: 'ai-kit sdlc scaffold feature --workspace /abs/path --module M-001 --id F-101 --name "OTP Login" --slug otp-login --priority high --consumed-by "M-002,M-003" --business-intent "Reduce account-takeover risk by adding OTP as 2FA second factor for sensitive operations" --acceptance-criteria \'["OTP delivered within 10s","3 failed attempts triggers cooldown"]\'',
  },
  hotfix: {
    summary: 'Atomically scaffold a hotfix (H-NNN) bypassing ba+sa+designer stages.',
    required: [
      ['--workspace, -w <path>', 'Workspace root path'],
      ['--id <H-NNN>',           'Hotfix ID (canonical H-NNN format)'],
      ['--name <name>',          'Hotfix name'],
      ['--slug <kebab>',         'Slug (kebab-case ASCII)'],
      ['--patch-summary <text>', 'Brief patch description'],
    ],
    optional: [
      ['--affected-modules <csv>',    'Modules touched by this hotfix'],
      ['--severity <s>',              'critical|high|medium|low (default: high)'],
      ['--severity-rationale <text>', 'Why this severity'],
    ],
    example: 'ai-kit sdlc scaffold hotfix --workspace . --id H-005 --name "Fix OTP timeout" --slug fix-otp-timeout --patch-summary "..." --affected-modules M-001 --severity critical',
  },
};

function printScaffoldHelp() {
  process.stderr.write(`Usage: ai-kit sdlc scaffold <target> [flags]

Targets:
  workspace         Scaffold mini/mono workspace
  app-or-service    Add project to mono workspace
  module            Scaffold M-NNN module
  feature           Scaffold F-NNN feature (nested under parent module)
  hotfix            Scaffold H-NNN hotfix

Run 'ai-kit sdlc scaffold <target> --help' for per-target flags.

Common pitfalls:
  - workspace requires --type (NOT --workspace-type / --workspace_type)
  - feature requires --module (parent module ID, FK enforced)
  - All targets except hotfix require --slug (kebab-case ASCII, max 40 chars)
`);
}

function printScaffoldSubHelp(sub) {
  const spec = SCAFFOLD_HELP[sub];
  if (!spec) {
    process.stderr.write(`Unknown scaffold target: ${sub}\nRun 'ai-kit sdlc scaffold --help' for valid targets.\n`);
    return;
  }
  let out = `Usage: ai-kit sdlc scaffold ${sub} [flags]\n\n${spec.summary}\n\nRequired flags:\n`;
  for (const [flag, desc] of spec.required) {
    out += `  ${flag.padEnd(32)} ${desc}\n`;
  }
  if (spec.optional && spec.optional.length) {
    out += `\nOptional flags:\n`;
    for (const [flag, desc] of spec.optional) {
      out += `  ${flag.padEnd(32)} ${desc}\n`;
    }
  }
  if (spec.note) {
    out += `\nNote: ${spec.note}\n`;
  }
  out += `\nExample:\n  ${spec.example}\n`;
  process.stderr.write(out);
}

async function dispatchScaffold(argv) {
  if (!argv.length || argv[0] === '--help' || argv[0] === '-h') {
    printScaffoldHelp();
    process.exit(argv.length ? 0 : 2);
  }
  const sub = argv[0];
  const rest = argv.slice(1);
  if (rest.includes('--help') || rest.includes('-h')) {
    printScaffoldSubHelp(sub);
    process.exit(0);
  }
  const { flags } = parseFlags(rest);
  const mod = await import('./scaffold.mjs');

  if (sub === 'workspace') {
    return await emitFromCall(() => mod.scaffoldWorkspaceImpl(
      flags.workspace || flags.w,
      flags.type,
      flags.stack || 'none',
      jsonOrNull(flags.config),
      bool(flags.force, false),
    ), 'ai-kit sdlc scaffold workspace --help');
  }
  if (sub === 'app-or-service') {
    return await emitFromCall(() => mod.scaffoldAppOrServiceImpl(
      flags.workspace || flags.w,
      flags.name,
      flags.kind,
      flags.stack || 'none',
      { expected_workspace_version: intOrNull(flags['expected-version']) },
    ), 'ai-kit sdlc scaffold app-or-service --help');
  }
  if (sub === 'module') {
    return await emitFromCall(() => mod.scaffoldModuleImpl(
      flags.workspace || flags.w,
      flags.id,
      flags.name,
      flags.slug,
      {
        modules_in_scope: csv(flags['modules-in-scope']) || [],
        depends_on: csv(flags['depends-on']) || [],
        primary_service: flags['primary-service'] || '',
        agent_flags: jsonOrNull(flags['agent-flags']) || {},
        business_goal: flags['business-goal'] || '',
        output_mode: flags['output-mode'] || 'lean',
        risk_path: flags['risk-path'] || 'M',
        expected_catalog_version: intOrNull(flags['expected-version']),
        stages_to_create: parseStagesFlag(flags.stages),
      },
    ), 'ai-kit sdlc scaffold module --help');
  }
  if (sub === 'feature') {
    return await emitFromCall(() => mod.scaffoldFeatureImpl(
      flags.workspace || flags.w,
      flags.module,
      flags.id,
      flags.name,
      flags.slug,
      {
        description: flags.description || '',
        business_intent: flags['business-intent'] || '',
        flow_summary: flags['flow-summary'] || '',
        acceptance_criteria: jsonOrNull(flags['acceptance-criteria']) || [],
        consumed_by_modules: csv(flags['consumed-by']) || [],
        priority: flags.priority || 'medium',
        expected_module_version: intOrNull(flags['expected-version']),
        stages_to_create: parseStagesFlag(flags.stages),
      },
    ), 'ai-kit sdlc scaffold feature --help');
  }
  if (sub === 'hotfix') {
    return await emitFromCall(() => mod.scaffoldHotfixImpl(
      flags.workspace || flags.w,
      flags.id,
      flags.name,
      flags.slug,
      flags['patch-summary'],
      {
        affected_modules: csv(flags['affected-modules']) || [],
        severity: flags.severity || 'high',
        severity_rationale: flags['severity-rationale'] || '',
      },
    ), 'ai-kit sdlc scaffold hotfix --help');
  }
  process.stderr.write(`Unknown scaffold target: ${sub}\n`);
  process.exit(2);
}

async function dispatchRefactor(argv) {
  if (!argv.length) {
    process.stderr.write('refactor requires sub-subcommand: rename-module-slug\n');
    process.exit(2);
  }
  const sub = argv[0];
  const rest = argv.slice(1);
  const { flags } = parseFlags(rest);
  const mod = await import('./refactor.mjs');

  if (sub === 'rename-module-slug') {
    return await emitFromCall(() => mod.renameModuleSlugImpl(
      flags.workspace || flags.w,
      flags.id,
      flags['new-slug'],
      flags.reason,
      { expected_version: intOrNull(flags['expected-version']) },
    ));
  }
  process.stderr.write(`Unknown refactor target: ${sub}\n`);
  process.exit(2);
}

async function dispatchState(argv) {
  if (!argv.length) {
    process.stderr.write('state requires sub-subcommand: update\n');
    process.exit(2);
  }
  const sub = argv[0];
  const rest = argv.slice(1);
  const { flags } = parseFlags(rest);
  const mod = await import('./state.mjs');

  if (sub === 'update') {
    const opts = {
      field_path: flags.path,
      field_value: flags.value !== undefined ? JSON.parse(flags.value) : undefined,
      stage: flags.stage,
      verdict: flags.verdict,
      artifact: flags.artifact || '',
      date: flags.date,
      metric: flags.metric,
      delta_value: flags['delta-value'] !== undefined ? JSON.parse(flags['delta-value']) : undefined,
      kpi_op: flags['kpi-op'] || 'set',
      log_kind: flags['log-kind'],
      entry: jsonOrNull(flags.entry),
      entity_id: flags['entity-id'],
      status: flags.status,
      evidence: jsonOrNull(flags.evidence),
      target_stage: flags['target-stage'],
      archive_artifacts: bool(flags.archive, true),
      reopened_reason: flags['reopened-reason'],
      force: bool(flags.force, false),
      expected_version: intOrNull(flags['expected-version']),
    };
    // Strip undefined keys for clean impl call
    for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];
    return await emitFromCall(() => mod.updateStateImpl(
      flags.workspace || flags.w,
      flags.file,
      flags.op,
      opts,
    ));
  }
  process.stderr.write(`Unknown state op: ${sub}\n`);
  process.exit(2);
}
