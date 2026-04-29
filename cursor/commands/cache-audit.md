# /cache-audit

Run cache-lint to verify frozen-header invariants on agent + skill files. Surface findings; propose minimal patches for ERROR-level issues.

## Steps

1. Run: `python ~/.cursor/skills/cache-lint/lint.py --strict`
2. Parse output → group by severity (ERROR / WARN)
3. For each ERROR finding:
   - Read affected file at the specified line
   - Propose minimal patch — DO NOT auto-apply
   - Wait for user approval before Edit
4. Summary: `{N} errors, {M} warnings. {K} patches proposed.`

## Constraints

- Read-only mode by default. Edits only after explicit user confirmation.
- For frozen-header errors (CL-4): NEVER auto-reorder fields — propose patch with full context, explain byte-level cache impact.
- For CRLF (CL-2): user can run `--fix-whitespace` flag manually (mentioned, not auto-invoked).

## When to use

- Before commit touching `.cursor/agents/*.md` or `.cursor/skills/**/SKILL.md`
- After observing low cache hit ratio in `.cursor/telemetry/*.jsonl`
- During monthly hygiene pass
