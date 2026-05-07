# Enterprise Delivery Pipeline — Agent System Overview

This file provides shared context for all agents in `~/.cursor/agents/`.

## Shared Mission

Every agent in this pipeline exists to serve one shared goal:

> **Deliver high-quality software safely, quickly, and traceably — without shortcuts that create hidden risk.**

This mission takes precedence over individual role optimization. When two agents disagree, resolution favors the shared goal, not either agent's local preference. Speed is not a valid reason to skip a gate. Quality is not a valid reason to block indefinitely. Every agent contributes to the mission from its own domain of expertise.

<!-- Why this exists: Research from ICWSM 2025 shows cooperative framing causes agents to converge
     significantly faster with higher success rates. Agents told they share a goal resolve
     conflicts more effectively than agents optimizing only their own domain. -->

## Execution Architecture (2026-05-04 — PM as orchestrator)

```
Skill (thin entry)  →  PM (orchestrator + judgment)  →  Agent (specialist work)
                              ↑
                       reads dispatcher.md (reference playbook for routing/validation/state)
```

- **Skill** = thin entry point. Parses args, creates/validates `_state.md`, acquires lock, then makes a SINGLE `Task(pm, mode=orchestrate)` call. Surfaces PM's final verdict to user. Skill does NOT loop.
- **PM** = pipeline orchestrator + judgment caller. Drives feature end-to-end via `Task(specialist)` calls. Reads `_state.md`, dispatches per stage, validates artifact, updates state, applies judgment INLINE (path selection, extended roles, exceptions). Stops only on legitimate exit (done | hard-blocked | user-needed | iter≥200). See `pm.md § Orchestrate Mode`.
- **dispatcher.md** = reference playbook (deprecated as callable agent). Contains Routing Table, Task Prompt Template, Artifact Validation, State Update Protocol, Escalation Triggers, Token Budget, Tiered Routing, Wave Batching. PM reads sections on-demand. Frontmatter `name: dispatcher` retained as escape hatch only.
- **Agent** = specialist. Does the actual work (ba, sa, dev, qa, reviewer, tech-lead...). Returns verdict JSON. Never spawns other agents.

**Loop ownership: PM** (in Orchestrate Mode). Skill is one-shot dispatcher of PM. This eliminates main-chat fragility on stage boundaries that plagued the older skill→dispatcher→agent pattern.

> **Architecture history**:
> - Original (≤2026-05-03): skill ran outer loop calling `Task(dispatcher)` per stage; dispatcher routed to `Task(agent)`. Failed because composer-2 main-chat couldn't reliably maintain loop state across Task() returns — fell into "do work itself" mode (F-007 spike evidence).
> - Current (2026-05-04+): skill → `Task(pm, mode=orchestrate)` → PM loops `Task(specialist)`. Empirical pattern from `@pm "làm việc A"` invocations that worked end-to-end.

## Worktree Workflow (Cursor 3+ native — recommended for parallel features)

Default human-team pattern: 1 feature = 1 git branch + 1 worktree. SDLC pipeline runs entirely inside the worktree; merge to main on close-feature via Cursor's built-in `/apply-worktree`.

### Lifecycle

```
1. User opens Cursor agent location dropdown → selects "Worktree"
2. Cursor auto-creates branch + worktree at ~/.cursor/worktrees/{repo}/{name}
3. User runs /new-feature {id} INSIDE the worktree agent
   ↓
   Skill detects $ROOT_WORKTREE_PATH → records worktree-path/branch/base in _state.md
   Skill calls Task(pm, mode=orchestrate, worktree-mode=true, repo-path=$ROOT_WORKTREE_PATH)
   PM dispatches specialists → all file writes happen in worktree
   ↓
4. Pipeline completes (Approved verdict) → user runs /close-feature {id} INSIDE the worktree agent
   ↓
   Skill seals _state.md, syncs feature-catalog.json, regen intel snapshot
   Skill prints: "Run /apply-worktree to merge, /delete-worktree to cleanup"
   ↓
5. User runs /apply-worktree → Cursor merges branch to main
6. User runs /delete-worktree → Cursor removes worktree (or auto-cleanup after 6h)
7. (If intel-drift was set) user runs /intel-refresh in main checkout
```

### Detection contract

Skills detect worktree via `$ROOT_WORKTREE_PATH` env var. Cursor sets this automatically when agent runs in worktree mode. If unset → skill operates in main checkout (legacy / solo flow).

### Forbidden in skills

- ❌ Manually running `git worktree add` / `git worktree remove` — Cursor manages
- ❌ Manually running `git merge` — `/apply-worktree` provides reviewable merge
- ❌ Forcing apply with uncommitted changes — let user review first
- ❌ Cleanup interval handling — Cursor's `cursor.worktreeCleanupIntervalHours` (default 6h) does this

### Setup hooks (optional, per project)

`.cursor/worktrees.json` in repo root supports `setup-worktree` array (run on worktree create). Use for: `npm install`, `pip install -r requirements.txt`, `cp .env.local .env`, etc. Skip for our SDLC pipeline — specialists install on-demand.

Reference: https://cursor.com/docs/configuration/worktrees

## Dispatch Model Canonicalization (audit-2026-05-06 T2-11)

**Canonical pattern**: all SDLC pipeline skills follow the **2026-05-04 thin-entry pattern** — Skill parses args + validates state + acquires lock + makes a SINGLE `Task(pm, mode=orchestrate)` call. PM drives pipeline end-to-end via per-stage `Task(specialist)` dispatches.

**Skills following canonical pattern** (full PM-orchestrator dispatch):
- `/new-feature`, `/resume-feature`, `/hotfix`, `/close-feature`, `/new-module`, `/resume-module`

**Skills with documented exceptions** (direct sub-agent dispatch — historical, retained for now):
- `/from-doc`, `/from-code` — own internal state machines (`_pipeline-state.json`); dispatch `doc-intel`, `code-harvester`, `code-intel` directly because phase logic is research-domain-specific (not SDLC)
- `/intel-refresh` — invokes `from-doc` / `from-code` + `intel-merger` + `intel-validator` directly because it orchestrates producers, not stages
- `/generate-docs` — 6-stage internal pipeline (Stage 0-6) with own dispatch logic; producer-agnostic per CD-10

**Migration roadmap**: Currently keep both patterns; future refactor (T2-11 follow-up) may unify under single PM-orchestrator if specialists for research/intel/doc-generation can be classified as SDLC stages with PM judgment value-add. Until then, treat the two patterns as deliberate domain split: PM owns SDLC stages, skill-internal dispatchers own research/producer/doc-generation flows.

---

## Entry Points — When to Use What

| Scenario | Entry | Flow |
|---|---|---|
| New feature with clear scope | `/new-feature` | Skill → dispatcher loop (PM called after BA for path selection, then on exceptions) |
| Document-driven pipeline (PDF/DOCX input) | `/from-doc` | Skill → dispatcher loop (doc-intel first, then same PM escalation pattern) |
| Known bug, root cause identified | `/hotfix` | Skill → dispatcher loop (PM called only on QA fail/blocked for risk ≥ 3) |
| Resume interrupted pipeline | `/new-feature {id}` (resume flow) | Skill → dispatcher loop (PM called if blocked state needs resolution) |
| Unstructured request from PO | `@pm` (intake mode) | PM creates `_state.md` → user runs skill to start dispatcher loop |
| Files dropped in `docs/input/` | `@pm` (folder scan mode) | PM detects files → creates `_state.md` → user runs skill to continue |
| Pipeline status / health check | `/feature-status` | Skill reads `_state.md` directly — no PM, no dispatcher |

**Rule of thumb:** Use skills for entry. Dispatcher runs the loop. PM is called automatically when judgment is needed — you don't invoke PM manually during pipeline execution.

## Prompt Cache Strategy

All agent prompts use 4-block structure (static → dynamic):
```
## Agent Brief          ← static
## Project Conventions  ← semi-static (≤5 items from 40-project-knowledge.mdc)
## Feature Context      ← per-feature stable
## Inputs               ← dynamic (always last)
```

Rules: never put variable data above `## Feature Context`; never reorder; always include all 4 headers (use `(none)` if empty).

Full template: see `agents/dispatcher.md` § Task Prompt Template.

Composer 2 auto-compresses when context approaches 200K (no config needed).

## Pipeline Architecture

Three delivery paths. **PM selects path after BA completes** (dispatcher escalates to PM via `pm-required` after BA stage).

### Path S — Simple (risk_score 1–2)

```
[ba] → PM selects path → [tech-lead] → [dev] → [reviewer (inline QA)]
```

- **Skips:** sa, dedicated qa agent
- **PM involvement:** Called once after BA (path selection). Dispatcher handles simple rework (≤2 loops) without PM.
- Designer still invoked when UI/UX impact is flagged

### Path M — Standard (risk_score 3)

```
[ba] → PM selects path → [designer?] → [sa] → [tech-lead] → [dev] → [qa] → [reviewer]
```

- `ba` self-decides whether to run domain modeling (Phase 2) based on triage
- **PM involvement:** Called after BA (path selection) + on QA Fail or Reviewer Changes Requested + on any Blocked/Need clarification.

### Path L — Complex (risk_score 4–5)

```
[ba] → PM selects path → [designer?] → [sa] + [security design]
     → [tech-lead] → [dev]
     → [qa] → [security code review] → [reviewer]
```

- `ba` runs both BA + domain modeling in one stage
- `security` invoked twice: alongside `sa` (design review) + alongside `reviewer` (code review)
- **PM involvement:** Called on **every stage transition** (safety net for high-risk pipelines). Extended roles (`devops`, `release-manager`, `sre`) added by PM during escalation.

**Path selection is PM's judgment call** — dispatcher escalates to PM after BA with `pm-trigger: Post-BA path selection`. PM reads BA verdict + risk_score → sets `stages-queue` → dispatcher continues.


---

## etc-platform MCP (centralized shared state)

Unified server at `localhost:8001/sse` (post-merge 2026-04-28; `:8000` back-compat alias active during migration). **35 tools** post-v3.2.0 = 24 existing (template_registry, outlines, KB, DEDUP, intel cache, render pipeline) + 11 NEW SDLC scaffolding (per ADR-003 D6/D7/D8/D11):

**SDLC tools** (call instead of Write/glob — CD-8 v3 enforcement):
- Atomic create: `scaffold_workspace`, `scaffold_app_or_service`, `scaffold_module`, `scaffold_feature`, `scaffold_hotfix`
- Refactor: `rename_module_slug` (atomic slug evolution)
- Read: `resolve_path` (replace ALL glob fallback for `docs/{modules,features,hotfixes}/**`)
- Repair: `autofix(fix_classes, dry_run, confirm_destructive)`
- Mutate: `update_state(file, op)` — 5 ops via discriminator (field/progress/kpi/log/status)
- Verify: `verify(scopes[], strict_mode)` — 8 scopes; catches F-061 namespace collision bug class
- Templates: `template_registry(namespace, action)` — list+load consolidated

**Default ON** cho mọi agent/skill reference local KB / DEDUP / templates / outlines. **MCP unavailable → BLOCK pipeline** per CLAUDE.md CD-8 v3 (no silent local fallback). User phải `docker compose up -d` từ `~/.ai-kit/team-ai-config/mcp/etc-platform/` trước khi retry.

**Single source of truth:** `~/.claude/schemas/intel/MCP-CONTRACT.md` + ADR-003 (`D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md`).

**SDLC structure (locked per CD-22):** `docs/modules/M-NNN-{slug}/` + nested `features/F-NNN-{slug}/` + `docs/hotfixes/H-NNN-{slug}/`. Catalog files: `docs/intel/{module,feature}-catalog.json`. Map files MOVED INTO `docs/intel/{module,feature}-map.yaml` (per ADR-003 D9-4). Maps replace glob fallback.

**Forbidden in agents** (CD-8 v3):
- ❌ Write tool to scaffolding files (_state.md, _feature.md, briefs, schemas, catalogs, maps)
- ❌ Bash mkdir for docs/{modules,features,hotfixes}/**
- ❌ Glob docs/{modules,features,hotfixes}/** for resolution
- ✅ Edit existing artifact files for in-place updates IF field NOT in `locked-fields[]`
- ✅ Write code source files in apps/services/libs/{src,internal,cmd}/** (not affected)

**CLI error recovery protocol** (audit 2026-05-07 — never spelunk source):

When `ai-kit sdlc <cmd>` returns `{ok: false, error: {...}}`, parse the error response BEFORE retrying or reading source. Standard error shape:

```json
{
  "ok": false,
  "error": {
    "code": "MCP_E_INVALID_INPUT" | "MCP_E_NOT_FOUND" | "MCP_E_VERSION_CONFLICT" | ...,
    "message": "<human-readable with valid range inline>",
    "details": {
      "flag": "--<flag-name>",                      // CLI flag that caused error
      "expected_regex": "<regex>" | "allowed": [...] // constraint
    },
    "fix_hint": "<concrete guidance with example>",
    "help_command": "ai-kit sdlc <subcmd> --help"   // recovery action
  }
}
```

Recovery sequence:
1. Read `error.fix_hint` — has concrete example with correct flag value.
2. If insufficient, run `Bash(error.help_command)` — returns full flag spec + canonical example.
3. Retry with corrected flags.
4. **NEVER** read `bin/lib/sdlc/*.mjs` source code to debug args — that wastes context. Help + fix_hint are the canonical spec.
5. If 2 retries still fail, SURFACE error to user with the full error response — don't loop.

Anonymization mandate (`intel_cache_contribute`): `contributor_consent=True` required; server scan rejects PII / customer hints.

---

## On-demand reference docs (load only when needed)

These are NOT loaded automatically — agents READ them when working in their domain. Keeps every chat under ~3K tokens for AGENTS.md baseline.

| File | Contents | Loaded by |
|---|---|---|
| `agents/ref-pm-rules.md` | Stage Gate Rules, Extended Roles, Doc Generation Agents, Verdict Taxonomy, Cross-Agent Traceability, Domain Authority, Refinement Loop Limits, Dev Wave Rules | `pm`, `dispatcher` |
| `agents/ref-pm-standards.md` | Output Mode (lean/full), Artifact Compression, Token Tracking, Artifact Format Standard, Context Bundle Standard, Artifact Directory Structure | `pm`, `reviewer`, any artifact producer |
| `agents/ref-pm-dispatch.md` | Dispatcher loop + Task Prompt Template (4-block) | `dispatcher` |
| `agents/ref-pm-mcp.md` | MCP server usage (NX, GitHub, DB) | All |
| `agents/ref-pm-templates.md` | Artifact templates per agent | Producers |
| `agents/ref-pm-exceptions.md` | Exception escalation matrix | `pm` |
| `agents/ref-pm-retrospective.md` | Retrospective format | `pm` |
| `agents/ref-pm-proactive.md` | Proactive flagging rules | `pm` |
| `agents/ref-canonical-intel.md` | CD-10 Intel Layer canonical paths | `tdoc-*`, `doc-intel` |
| `agents/telemetry.md` | Telemetry capture agent (sonnet, append-only JSONL) | dispatcher loop after every stage advance |

## Slash Commands (replaces removed Custom Modes feature)

Cursor 2.1.0 (Nov 2025) removed Custom Modes. Replacement = `.cursor/commands/*.md` slash commands.

Available SDLC commands (see `commands/sdlc-roles.md` for index):
- `/cache-audit` — run cache-lint + propose patches
- `/telemetry-report {feature-id}` — aggregate `.cursor/telemetry/*.jsonl`
- (More role commands: dev-mode, qa-mode, reviewer-mode, architect-mode — to be created from existing agents/*.md as needed)

**Limitation acknowledged**: slash commands cannot restrict tool access per command (Custom Modes had this). Mitigation: rules-based discipline via `rules/50-sdlc-role-coding.mdc` auto-attached by glob.

**Model routing reality**: Task tool's `model` parameter currently accepts only `"fast"` or `"inherit"` (forum-confirmed, no ETA for fix). Per-stage model control is via subagent `.md` frontmatter ONLY — not call-time override. Tiered routing therefore uses dual-agent file pattern (`{role}.md` + `{role}-pro.md`); see `agents/dispatcher.md` § Tiered Routing.

## Cache + Telemetry Tooling

- `skills/cache-lint/` — Hard-enforce frozen-header invariants. Run `python lint.py --strict` before commits to `.cursor/agents/` or `.cursor/skills/`.
- `skills/cache-lint/make-pro-agents.py` — Generate `*-pro.md` from base agents. Run after editing any base agent (sync drift check via `--check`).
- `skills/intel-snapshot/` — Generate compressed `_snapshot.md` from canonical intel JSON. Base-tier agents read snapshot (3-5K tokens) instead of full JSON (40-130K). Saves ~95% on intel reads. Run `python generate.py` after intel write; `--check` for staleness.
- `.cursor/telemetry/{feature-id}.jsonl` — Append-only event log (schema v2 — full token_usage breakdown). Real cache discount ratio, tier escalation rate, real cost (not gross). Written inline by skill (no sub-agent overhead). Aggregate via `/telemetry-report`.
- PM adaptive escalation reads telemetry (last 50 events) before deciding — replaces static `risk_score` thresholds. See `agents/ref-pm-proactive.md`.
- Auto-attached SDLC rule: `rules/50-sdlc-role-coding.mdc` (globs on `src/**`, `tests/**`).

## Cursor Token Rules (extends Claude CD-10)

> **Numbering note**: Claude global `~/.claude/CLAUDE.md` § CD-10 reserves numbers 1–21 (last: Production-line lifecycle contract). Cursor extensions start at **22** to avoid clash. Always cite the source: `CD-10 #N` for Claude rules; `Cursor Rule N` for these extensions.

**Cursor Rule 22 — Tier-aware intel reads.** Base-tier agents (`dev`, `qa`, `reviewer`, `ba`, `sa` non-pro) MUST read `_snapshot.md` first. Fall back to canonical JSON only when snapshot stale OR judgment-critical section needed (auth, full AC text, workflow variants). Pro-tier agents (`*-pro`, `tech-lead`, `security`) MUST read canonical JSON. See `agents/ref-canonical-intel.md` § Tier-aware read protocol.

**Cursor Rule 23 — Token usage breakdown.** All agents MUST emit `token_usage` v2 schema in verdict (input_fresh, input_cache_read, input_cache_write, output_text, output_reasoning, apply_model). Use `null` for fields the platform doesn't expose — NEVER fake zero. Telemetry computes real cost via weighted formula (cache reads × 0.1, output × 5.0, etc). See `agents/ref-pm-standards.md` § Token Tracking Standard v2 + `commands/telemetry-report.md` § Real-cost formula.

**Cursor Rule 24 — Snapshot regen contract.** Producers (`from-doc`, `from-code`, `intel-merger`) MUST call `python ~/.cursor/skills/intel-snapshot/generate.py` after writing any canonical intel artifact. Failure to regen = stale snapshot = consumers fall back to expensive full JSON reads. Drift gate: `close-feature` runs `--check` before sealing.

## Universal Agent Guardrails

These apply to **every agent** in this pipeline without exception.

### 1 — Reversibility check before destructive actions
Before any action that is hard to reverse (file deletion, schema migration, production config change, dependency removal), explicitly state:
- What the action is
- Why it is necessary
- How to reverse it if something goes wrong

Then proceed. Do not skip this even under time pressure.

<!-- Why: Irreversible actions in a pipeline compound. A bad migration run at 2am cannot be
     fixed by the next agent in the chain — it blocks everything. Stating reversibility
     forces the agent to verify it has thought through the action. -->

### 2 — Clarify before assuming
If required inputs are absent or ambiguous, stop and ask for the specific missing information. Do not assume and proceed — incorrect assumptions at any stage cause rework at every downstream stage.

List all ambiguities at once, not one-by-one. Format each as:
```
[GAP-001] What is missing and why it matters
- Impact if wrong assumption: ...
- Question: ...
```

<!-- Why: FM-2.2 from MASFT taxonomy — agents proceeding without clarification is the second
     most common inter-agent failure mode. It creates silent scope drift that surfaces only
     at QA or Review, costing 3-5x more effort to fix. -->

### 3 — Reflect before handing off
After completing your work and before writing your handoff verdict, pause and evaluate:
- Does my output actually answer all the inputs I was given?
- Is there anything I skipped, assumed, or deferred without flagging it?
- Would the next agent in the pipeline have everything they need?

Only proceed with the handoff after this self-check.

<!-- Why: Interleaved reflection between task steps is a core pattern from Lilian Weng's agent
     survey and Anthropic's production systems. Agents that reflect before handoff catch
     their own blind spots rather than passing them downstream. -->

### 4 — Never exceed role scope
If a request asks you to do work outside your defined role (e.g., BA is asked to write code, dev is asked to rewrite requirements), refuse that part explicitly and state which agent should handle it instead.

<!-- Why: FM-1.2 from MASFT taxonomy — scope creep is a top failure mode. When agents do
     work outside their role, the artifact becomes the wrong agent's responsibility, stage
     gates lose meaning, and the pipeline cannot resume correctly. -->

### 5 — State "done when" explicitly
Every agent response must include a clear completion signal. Verdict labels serve this purpose. Do not end a response with open-ended statements like "let me know if you need more." End with the exact verdict label for your role and one concrete next action.

<!-- Why: FM-1.5 from MASFT taxonomy — agents that don't know when to stop are a documented
     failure mode. Explicit termination criteria prevent both premature completion (rubber-
     stamping) and infinite refinement loops. -->

## Subagent Technical Notes (Cursor-specific, 2026-05-04+)

- Each agent runs in **isolated context** — no conversation history is inherited.
- `Task` tool invocation pattern:
  - **Skill (main-chat)** spawns ONE `Task(pm, mode=orchestrate)` per skill invocation. Skill does NOT loop.
  - **PM** invokes specialist agents via `Task(subagent_type="{role}")` per `dispatcher.md § Routing Table`. PM reads `dispatcher.md` sections on-demand for routing/validation/state-update logic. PM applies judgment (path selection, exceptions, extended roles) INLINE — no PM→PM escalation.
  - **Specialist agents** (ba/sa/dev/qa/reviewer/tech-lead/...) NEVER invoke other agents. Each returns verdict JSON to PM.
- **Model policy (2026-05-04 cost-fix)**: agents have **explicit** `model:` frontmatter (NOT `auto`) to prevent Cursor IDE auto-router from picking expensive models like GPT-5.5/Codex when user just wants Composer 2.
  - **Base SDLC + Support agents** (ba, sa, dev, fe-dev, qa, reviewer, tech-lead, pm, designer, devops, security, sre-observability, data-governance, release-manager, telemetry): `model: composer-2` (Standard variant — $0.50/M input, $2.50/M output, $0.20/M cache read)
  - **Pro escalation** (ba-pro, sa-pro, dev-pro, qa-pro, reviewer-pro): `model: claude-opus-4-7` (only invoked when base agent returns confidence: low or stage triggers force-escalation per `dispatcher.md § Tiered Routing`)
  - **Reference docs** (dispatcher.md, ref-pm-*.md): `model: auto` retained — not invoked as Task() agents
  - **Why explicit not auto**: F-007/F-008 evidence — Cursor `auto` routing chose composer-2-fast ($1.50/M) for PM and GPT-5.5 ($5+/M) / Codex 5.3 ($5+/M) for specialists, blowing budget. Explicit `composer-2` forces Standard variant 3× cheaper than Fast.
  - **Why "composer-2" not "composer-2-fast"**: Composer 2 Standard ($0.50/$2.50) is the cost-optimized variant. "Fast" in the name = latency-optimized = 3× MORE expensive ($1.50/$7.50). Confusing naming — beware.
  - **Pro tier as universal escalation target**: `claude-opus-4-7` chosen because Cursor subagent `model:` field has narrow accepted values per role/plan. Update if cross-vendor subagent routing stabilizes.
- Frontmatter `readonly: true` is **forbidden** for any agent that writes artifacts (own_write list non-empty). Setting `readonly: true` on a writer agent causes Cursor to spawn the subagent in Ask mode → cannot create files → ART-001 blocker. (Reviewer/reviewer-pro/sre-observability had this bug; fixed 2026-05-04.)
- Nesting depth: skill → PM → agent (2 levels of `Task()` from main-chat) is the working pattern. Going deeper (agent spawning sub-agent) is not supported and not needed — each specialist is a leaf. PM reading `dispatcher.md` sections via Read tool does NOT count as nesting (no Task() involved).

### Prompt Caching (cost optimization)

Anthropic supports prompt caching — the static system prompt portion is cached after the first invocation and costs ~5% on subsequent reads. To maximize cache hits:

- Keep the **static** portion of every agent prompt (role definition, principles, output format) at the **top** of the prompt, before any dynamic content (feature-id, docs-path, artifact content).
- Pass dynamic context (feature-specific inputs) **after** the static system prompt, clearly separated by a `---` divider or `## Task Input` header.
- For agents invoked multiple times in a pipeline (especially `dev`, `qa`), caching the system prompt reduces per-invocation cost by ~90% on the static portion.
- Do not mix static instructions with dynamic content inside the same section — this breaks cache reuse.

<!-- Why: dev invoked 9 times (3 waves × 3 tasks) without caching = 9 × 4,168 tokens = 37,512
     tokens for system prompts alone. With caching = 4,168 + 8 × 208 ≈ 5,832 tokens.
     Saving: ~31,680 tokens per feature just from dev system prompt caching. -->
