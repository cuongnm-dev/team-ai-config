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

async function emitFromCall(fn) {
  try {
    const result = await fn();
    emit(result);
  } catch (err) {
    if (err instanceof SdlcError) {
      emit(err.toResponse());
    } else {
      // Unexpected — write to stderr, JSON shape to stdout for caller, exit 2
      process.stderr.write(`ai-kit sdlc internal error: ${err.stack || err.message}\n`);
      process.stdout.write(JSON.stringify({
        ok: false,
        error: { code: 'MCP_E_INTERNAL', message: err.message, details: { stack: err.stack } },
      }) + '\n');
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

async function dispatchScaffold(argv) {
  if (!argv.length) {
    process.stderr.write('scaffold requires sub-subcommand: workspace | app-or-service | module | feature | hotfix\n');
    process.exit(2);
  }
  const sub = argv[0];
  const rest = argv.slice(1);
  const { flags } = parseFlags(rest);
  const mod = await import('./scaffold.mjs');

  if (sub === 'workspace') {
    return await emitFromCall(() => mod.scaffoldWorkspaceImpl(
      flags.workspace || flags.w,
      flags.type,
      flags.stack || 'none',
      jsonOrNull(flags.config),
      bool(flags.force, false),
    ));
  }
  if (sub === 'app-or-service') {
    return await emitFromCall(() => mod.scaffoldAppOrServiceImpl(
      flags.workspace || flags.w,
      flags.name,
      flags.kind,
      flags.stack || 'none',
      { expected_workspace_version: intOrNull(flags['expected-version']) },
    ));
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
      },
    ));
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
      },
    ));
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
    ));
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
