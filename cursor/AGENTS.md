# Enterprise Delivery Pipeline — Agent System Overview

This file provides shared context for all agents in `~/.cursor/agents/`.

## Shared Mission

Every agent in this pipeline exists to serve one shared goal:

> **Deliver high-quality software safely, quickly, and traceably — without shortcuts that create hidden risk.**

This mission takes precedence over individual role optimization. When two agents disagree, resolution favors the shared goal, not either agent's local preference. Speed is not a valid reason to skip a gate. Quality is not a valid reason to block indefinitely. Every agent contributes to the mission from its own domain of expertise.

<!-- Why this exists: Research from ICWSM 2025 shows cooperative framing causes agents to converge
     significantly faster with higher success rates. Agents told they share a goal resolve
     conflicts more effectively than agents optimizing only their own domain. -->

## Execution Architecture

```
Skill (entry)  →  Dispatcher (loop)  →  Agent (work)
                       ↕ (pm-required)
                   PM (judgment)
```

- **Skill** = entry point. Creates `_state.md`, runs dispatcher loop.
- **Dispatcher** = executor. Runs one stage per invocation. Mechanical routing + state management. Escalates to PM when judgment needed.
- **PM** = orchestrator. Makes judgment calls: path selection, extended roles, exception handling. Only invoked on `pm-required` status from dispatcher, or directly by user (`@pm`).
- **Agent** = specialist. Does the actual work (ba, sa, dev, qa...).

Dispatcher runs the loop. PM is called **into** the loop when needed — not on every stage.

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

`localhost:8001/sse` (separate from `etc-docgen` on 8000). Tools: `template_registry_load`, `outline_load`, `kb_query/save`, `dedup_check/register`, `intel_cache_lookup/contribute`. **Default ON** for any agent/skill referencing local KB / DEDUP / templates / outlines. Local file fallback when MCP unavailable. Full contract: `~/.claude/CLAUDE.md` § MCP-1 to MCP-5.

Anonymization mandate (`intel_cache_contribute`): `contributor_consent=True` required; server scan rejects PII / customer hints. Explicit user opt-in per project.

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

## Token Attribution Rules (CD-10 extended for Cursor)

**Rule 19 — Tier-aware intel reads.** Base-tier agents (`dev`, `qa`, `reviewer`, `ba`, `sa` non-pro) MUST read `_snapshot.md` first. Fall back to canonical JSON only when snapshot stale OR judgment-critical section needed (auth, full AC text, workflow variants). Pro-tier agents (`*-pro`, `tech-lead`, `security`) MUST read canonical JSON. See `agents/ref-canonical-intel.md` § Tier-aware read protocol.

**Rule 20 — Token usage breakdown.** All agents MUST emit `token_usage` v2 schema in verdict (input_fresh, input_cache_read, input_cache_write, output_text, output_reasoning, apply_model). Use `null` for fields the platform doesn't expose — NEVER fake zero. Telemetry computes real cost via weighted formula (cache reads × 0.1, output × 5.0, etc). See `agents/ref-pm-standards.md` § Token Tracking Standard v2 + `commands/telemetry-report.md` § Real-cost formula.

**Rule 21 — Snapshot regen contract.** Producers (`from-doc`, `from-code`, `intel-merger`) MUST call `python ~/.cursor/skills/intel-snapshot/generate.py` after writing any canonical intel artifact. Failure to regen = stale snapshot = consumers fall back to expensive full JSON reads. Drift gate: `close-feature` runs `--check` before sealing.

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

## Subagent Technical Notes (Cursor-specific)

- Each agent runs in **isolated context** — no conversation history is inherited.
- `pm` passes `docs-path`, `feature-id`, and relevant artifact file paths in each subagent prompt. Each agent reads the files it needs directly — do not inline full artifact content unless the agent requires deep context (sa, tech-lead, reviewer).
- Use `Task` tool from `pm` to invoke agents. Parallelize read-only agents when safe.
- Do not use `Auto` model — always use Sonnet or Opus to ensure `Task` tool is available.
- Nested subagents (subagent spawning subagent) are **not supported**. Only `pm` spawns agents.

### Prompt Caching (cost optimization)

Anthropic supports prompt caching — the static system prompt portion is cached after the first invocation and costs ~5% on subsequent reads. To maximize cache hits:

- Keep the **static** portion of every agent prompt (role definition, principles, output format) at the **top** of the prompt, before any dynamic content (feature-id, docs-path, artifact content).
- Pass dynamic context (feature-specific inputs) **after** the static system prompt, clearly separated by a `---` divider or `## Task Input` header.
- For agents invoked multiple times in a pipeline (especially `dev`, `qa`), caching the system prompt reduces per-invocation cost by ~90% on the static portion.
- Do not mix static instructions with dynamic content inside the same section — this breaks cache reuse.

<!-- Why: dev invoked 9 times (3 waves × 3 tasks) without caching = 9 × 4,168 tokens = 37,512
     tokens for system prompts alone. With caching = 4,168 + 8 × 208 ≈ 5,832 tokens.
     Saving: ~31,680 tokens per feature just from dev system prompt caching. -->
