# Global Rules for Cascade

## Tech Stack
- **Frontend**: Angular 18+ (TypeScript), Vue 3 (TypeScript), SCSS/CSS
- **Backend**: Python 3.12+ (FastAPI / Flask), .NET (C#)
- **Infrastructure**: Docker, Docker Compose, PowerShell
- **Formatters**: Ruff (Python), Prettier (JS/TS/HTML/CSS), ESLint (TypeScript)
- **Testing**: Pytest (Python), Angular Testing (Jasmine/Karma), Playwright (E2E)

## General Principles
- Write minimal, focused changes — do not refactor code outside the scope of the request
- Prefer explicit over implicit; avoid magic patterns unless framework-standard
- Always use TypeScript strict mode — no `any` unless absolutely unavoidable with a comment
- Prefer composition over inheritance
- Keep functions/methods under 40 lines; components under 300 lines

## Python Conventions
- Follow PEP 8; Ruff is the formatter and linter — do not suggest Black or pylint overrides
- Use type hints on all function signatures
- Prefer `pathlib.Path` over `os.path`
- Use `dataclasses` or Pydantic models instead of plain dicts for structured data
- Exception handling: catch specific exceptions, never bare `except:`
- Use f-strings for string formatting

## Angular / TypeScript Conventions
- Use standalone components (Angular 17+ style) unless the project uses NgModule
- Signals preferred over RxJS for state when possible (Angular 17+)
- Services injected via `inject()` function, not constructor injection
- Component files: PascalCase (`UserCard.component.ts`)
- Services: camelCase with `.service.ts` suffix
- Avoid `any` — use `unknown` and narrow with type guards
- Import order: Angular core → third-party → project absolute → relative
- Do NOT use inline styles; use SCSS component files

## Vue Conventions
- Use Vue 3 Composition API with `<script setup>` syntax
- Props with TypeScript via `defineProps<T>()`
- Prefer `ref` for primitives, `reactive` for objects
- Component names: PascalCase in script, kebab-case in templates

## Docker & DevOps
- Multi-stage Dockerfiles for production builds
- Use named volumes, not anonymous volumes
- Health checks on all services
- Environment variables via `.env` files, never hardcoded in docker-compose.yml

## Anti-Patterns (NEVER DO)
- Never use `console.log` in production code — use a proper logger
- Never commit `.env` files or secrets
- Never use `*` wildcard imports
- Never mutate function arguments directly
- Never use `document.write()` or `eval()`
- Never add `// TODO` comments without a linked issue
- Never use `setTimeout` as a hack for async timing issues

## Code Review Mindset
- Before suggesting changes, understand WHY the existing code is structured that way
- Prefer fixing the root cause, not patching symptoms
- When adding a feature, check if a similar utility already exists in the codebase
- Always consider edge cases: null/undefined, empty arrays, network failures

---

# SDLC Pipeline Rules (ported from Cursor 2026-05-04)

## Architecture

```
Workflow (entry, e.g. /new-feature)  →  PM Skill (orchestrator)  →  Role Skill (specialist work)
                                              ↓
                                       reads dispatcher Skill (routing/validation reference)
```

- **Workflows** (slash commands) = user-invokable entry points. They prepare state then hand off to PM skill for orchestration.
- **PM skill** drives feature pipeline end-to-end. Loops through stages, auto-loads role skills via Cascade description matching.
- **Role skills** (ba/sa/dev/qa/reviewer/tech-lead/...) = specialist personas. Cascade auto-loads when current pipeline phase matches their description.
- **dispatcher skill** = reference playbook (routing table, validation rules, state-update protocol). PM reads on-demand.

## Pipeline Paths

- **Path S** (risk 1-2): `[ba, tech-lead, dev-wave-1, reviewer]` — no SA, no dedicated QA (reviewer inline)
- **Path M** (risk 3): `[ba, sa, tech-lead, dev-wave-1, qa-wave-1, reviewer]`
- **Path L** (risk 4-5): `[ba, sa, security-design, tech-lead, dev-wave-1, qa-wave-1, security-review, reviewer]` + extended roles per PM judgment

## State Management

- **`_state.md`** at `{docs-path}/_state.md` is the canonical pipeline state
- PM owns writes to: `current-stage`, `completed-stages`, `stages-queue`, `rework-count`, `clarification-notes`, `pipeline-path`, `risk_score`, `worktree-path`/`worktree-branch`/`worktree-base` (if applicable)
- Specialists do NOT write `_state.md` — only PM does
- Specialists output verdict JSON consumed by PM

## Verdict JSON Contract

Every specialist returns:
```json
{
  "verdict": "<exact label>",
  "confidence": "high | medium | low",
  "escalate_recommended": false,
  "escalation_reason": "...",
  "token_usage": {"input": ~N, "output": ~N, "this_agent": ~N, "pipeline_total": ~N}
}
```

Verdict labels per role: see role skill file.

## Pro Escalation

- Base role + pro variant pattern: `<role>` and `<role>-pro` skills
- Pro auto-loads when: confidence=low (retry), risk_score≥3 for reviewer, adr_assigned for sa, risk_score≥4 for ba, test failure rate >30% for dev, ac_coverage_pct <80 for qa
- Max 1 escalation per stage

## Worktree Workflow (Wave 13+)

- 1 feature = 1 git branch = 1 worktree (recommended for parallel)
- User selects "Worktree" location in Windsurf agent dropdown → Cascade creates branch + worktree
- Workflow detects worktree via env var, records in `_state.md`
- close-feature suggests merge slash command — never auto-merge

## Intel Layer (CD-10)

Canonical intel artifacts at `{repo-root}/docs/intel/`:
- `actor-registry.json` — roles + auth + RBAC mode
- `permission-matrix.json` — Role × Resource × Action
- `sitemap.json` — navigation + routes + Playwright hints
- `feature-catalog.json` — features with role-visibility tagging
- `test-accounts.json` — test credentials per role (gitignored if storage=inline)
- `test-evidence/{feature-id}.json` — playwright + execution + screenshot map
- `_snapshot.md` — compressed view (~5-7K tokens) for base-tier reads

Specialists rules:
1. Read intel BEFORE planning/coding — role slugs, route paths, permission decorators are CANONICAL
2. Required artifact missing or stale → STOP with `intel-missing` blocker
3. Code change touching auth/role/route/RBAC → set `intel-drift: true` in `_state.md`
4. JSON is source of truth — never ground decisions on prose alone
5. QA stage MUST co-produce 3 atomic artifacts: test-evidence/{id}.json + playwright/{id}.spec.ts + screenshots/{id}-step-NN-{state}.png

## Output Mode

- **lean** (default): minimal artifacts (00-lean-spec.md, 00-lean-architecture.md). Fast, compressed, targeted.
- **full**: full structured artifacts (multi-file ba/, sa/ folders). Used for compliance/audit.

## Cost Control

- Cascade default model: Adaptive router or SWE-1.5/1.6 (fast + cheap, free promo)
- Pro escalation: prefer Claude Sonnet 4.6 / Opus 4.7 only when truly needed
- Verdict format minimal (verdict + confidence + token_usage) — saves output tokens
- Token budget per pipeline path: S=80K, M=200K, L=500K (block at 95% used, swap to fast tier at 80%)
