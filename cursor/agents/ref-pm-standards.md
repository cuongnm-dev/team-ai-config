# Artifact Standards — Format, Compression, Output Mode, Context Bundle

> Loaded on-demand by `pm`, `reviewer`, and any agent producing artifacts. Do NOT load eagerly.
> Source of truth for artifact format (MANDATORY for SDLC), token tracking, lean/full mode, and per-agent context bundle.

## Output Mode

Every pipeline has an `output-mode` field in `_state.md` frontmatter. All agents must read this field before producing output.

| Mode | Default? | Artifact strategy | Token profile |
|---|---|---|---|
| `lean` | **Yes** | 1 dense structured file per stage (tables + IDs only) | ~70% lower than full |
| `full` | No (opt-in) | Full artifact set per stage (narrative + tables + all files) | Baseline |

**How to activate full mode:** Set `output-mode: full` in `_state.md` before starting the pipeline, or ask PM to switch mode mid-pipeline.

**When to use full mode:**
- Team review / stakeholder presentation needed
- Onboarding a new team member to the feature
- Compliance audit requiring narrative documentation
- Feature is high-risk (risk_score ≥ 4) and full paper trail is warranted

**Lean mode guarantees:** Even in lean mode, every artifact must contain all machine-readable content required for downstream agents and pipeline operations — AC IDs, BR IDs, handoff JSON, verdict, `_state.md` updates. Lean = compressed format, not missing information.

<!-- Why lean-first: Documentation writing is output tokens (~5x cost of input). A BA artifact
     written in full mode costs ~5,500 tokens output + ~3,000 tokens × 5 downstream reads =
     ~20,500 total. In lean mode: ~1,500 tokens output + ~875 × 5 reads = ~5,875 total.
     73% reduction, zero loss of pipeline function. -->

### Lean Artifact Paths (output-mode: lean)

In lean mode, ba and SA each write **one dense file** instead of their full artifact set.

| Agent | Lean artifact | Full artifact set |
|---|---|---|
| `ba` (BA phase) | `ba/00-lean-spec.md` | `ba/00` through `ba/07` (8 files) |
| `ba` (domain phase) | `domain-analyst/00-lean-domain.md` | `domain-analyst/00` through `domain-analyst/07` (7-8 files) |
| `sa` | `sa/00-lean-architecture.md` | `sa/00` through `sa/07` (8 files) |
| `tech-lead`, `dev`, `qa`, `reviewer` | Same single-file format regardless of mode | — |

---

## Artifact Compression Standard

All agents must use **structured formats** (tables, bullet lists, ID-keyed rows) instead of prose paragraphs wherever possible. This reduces token consumption at every downstream agent that reads the artifact.

**Rule:** If content can be expressed as a table row, express it as a table row.

| Content type | Compressed format | Avoid |
|---|---|---|
| Acceptance criteria | `\| AC-001 \| Actor \| Trigger → Outcome \| Constraint \|` | Paragraph description |
| Business rules | `\| BR-001 \| Rule statement \| Rationale \|` | Narrative explanation |
| User stories | `\| US-001 \| As [actor] I want [goal] so that [value] \|` | Multi-line story cards |
| Architecture decisions | `\| Decision \| Option chosen \| Reason \| Trade-off \|` | Prose ADR body |
| Task breakdown | `\| W1-T1 \| Task name \| Owner \| AC refs \| Estimate \|` | Numbered list with paragraphs |
| Defects / findings | `\| SEV \| ID \| Description \| AC ref \| Steps \|` | Paragraph per defect |
| Open questions | `\| Q-001 \| Question \| Impact if wrong \| Owner \|` | Bulleted list |

**Exceptions:** Narrative sections (business process AS-IS/TO-BE, architecture overview, executive summary) may use prose where a table would lose important context. Keep these sections concise — one paragraph maximum per concept.

<!-- Why: Structured formats reduce per-artifact token count by 40-50% while preserving all
     machine-readable information. A 20-AC spec in table format ≈ 300 tokens vs ≈ 1,000
     tokens in prose. This saving compounds across every agent that reads the artifact. -->

---

## Token Tracking Standard

Every agent appends a `token_usage` object to its handoff JSON. PM reads this after each stage and updates `_state.md → kpi.tokens_total`.

### Schema (v2 — breakdown for real-cost computation)

```json
"token_usage": {
  "input_fresh":       "<input tokens NOT served from cache (full price)>",
  "input_cache_read":  "<input tokens served from prefix cache (~10% price on Anthropic; varies by Cursor model)>",
  "input_cache_write": "<input tokens written to cache for this turn (~125% on Anthropic write)>",
  "output_text":       "<output text tokens (visible response + tool calls)>",
  "output_reasoning":  "<thinking tokens (Opus extended thinking; null if model lacks it)>",
  "apply_model":       "<tokens consumed by Cursor's apply-edit smaller model (null if no edits)>",
  "this_agent_total":  "<sum of all above; the 'gross' number — informational, not cost>",
  "pipeline_total":    "<this_agent_total + pipeline_total passed by PM — 0 if first agent>"
}
```

### Field availability (be honest — null when unknown)

**Cursor reality (verified 2026-04 forum)**: Agents cannot read their own token usage at runtime. Cursor tracks full breakdown (input/output/cache_read/cache_write/reasoning) only at dashboard level (`cursor.com/dashboard/usage`). The `agents-can-view-token-usage` feature is requested but not shipped.

Therefore, agents MUST estimate via char count and set `null` for cache/reasoning/apply fields. Telemetry treats null as "unmeasured" (different from "measured zero"). When dashboard data needed, user manually exports from Cursor UI; `/telemetry-report` flags `partial_attribution: true`.

| Field | Cursor exposes? | Fallback behavior |
|---|---|---|
| `input_fresh` | Partial — Cursor displays input total in chat status | If breakdown unknown → put total here, set cache fields to `null` |
| `input_cache_read` | Sometimes — visible in Anthropic models with prompt caching | Default `null` |
| `input_cache_write` | Rarely — needs Anthropic API direct visibility | Default `null` |
| `output_text` | Yes — agent counts its own response | Char count ÷ 4 |
| `output_reasoning` | Only for thinking-enabled Opus | Default `null` for non-Opus |
| `apply_model` | Cursor doesn't expose to agent | Always `null` (computed externally) |

### Estimation when platform doesn't expose

Agents cannot directly read API usage data. Use:
- Input: chars received ÷ 4 ≈ tokens (rough)
- Output: chars produced ÷ 4 ≈ tokens
- Prefix `~` to indicate estimate (e.g. `"~12500"`)
- For apply_model: mark `null` always — telemetry estimates from file-edit byte deltas during aggregation

### Real-cost computation (in /telemetry-report)

Cost is NOT `this_agent_total × $/token`. Real cost = weighted sum:
```
real_cost = (input_fresh × 1.0
           + input_cache_read × 0.1     # ~90% discount
           + input_cache_write × 1.25   # ~25% premium on write
           + output_text × 5.0          # output usually 5× input rate
           + output_reasoning × 5.0     # same as output rate
           + apply_model × 0.2          # apply uses smaller/cheaper model
          ) × model_rate_per_million / 1_000_000
```

(Multipliers are Anthropic-typical; adjust per actual Cursor model rate card.)

### PM protocol

1. Before invoking each subagent: pass `pipeline_total_tokens: {current kpi.tokens_total}` in the prompt
2. After each subagent returns: read `token_usage` → update `_state.md.kpi.tokens_total` (use `pipeline_total`) AND `kpi.tokens_by_stage.{agent}` (use `this_agent_total`)
3. Inline telemetry append (skill-side): write FULL breakdown to JSONL — not just total
4. Retrospective: surface real-cost breakdown table (use real_cost formula) in `09-retrospective.md`

**Purpose:** distinguish "saw 200K tokens" (gross, scary) from "paid for 60K equivalent" (real, manageable). Without breakdown, optimization decisions are guesswork.

---

## Artifact Format Standard (MANDATORY for SDLC pipeline)

**Scope:** Applies to **SDLC pipeline artifacts** (ba/, sa/, tech-lead plan, dev summaries, QA reports, review reports, extended role reports, doc-intel bridge files). Inter-agent artifacts must be machine-parseable.

**EXEMPT:** Admin-document pipelines (`doc-arch/tkcs/catalog/testcase/manual-writer`, `tdoc-*-writer` producing user-facing docs) — these target HUMAN readers in Vietnamese. Use existing document style.

### Rule 1: English structural + machine-readable

- **Frontmatter, field keys, IDs (US-001, AC-001, BR-001, BC-001, W1-T1), verdicts, table headers, JSON keys, YAML fields** → always **English**
- **Handoff JSON, `_state.md`** → 100% English (hard inter-agent contract)
- **Content values** (rule description, scenario text, rationale): English preferred; Vietnamese OK when quoting source doc verbatim or when business term has no established English equivalent
- **User-facing chat response** → Vietnamese (skill directive)

### Rule 2: Tables/structured > prose, BUT completeness over brevity

Write as **table row or YAML/JSON entry** whenever possible. But:

**Do NOT over-compress.** Preserve:
- ✅ **All metrics & thresholds** (latency SLO, error rate %, timeout seconds, retention days, token limits, rate limits)
- ✅ **Qualifiers** (`only when X`, `except if Y`, `applies to role Z`) — ambiguity = misunderstanding downstream
- ✅ **Rationale** for non-obvious decisions (1-sentence WHY)
- ✅ **Conditions & exceptions** (NOT just happy path)
- ✅ **Units** (ms vs s, MB vs GB, %, count)
- ✅ **Reference IDs** (AC-001, not "the login scenario")

**Prose allowed (don't force into tables):**
- Executive summary (3 sentences max)
- AS-IS/TO-BE narrative (full mode `01-business-process.md` only)
- Architecture overview in `sa/00` (2-3 paragraphs)
- Risk analysis with cause-effect chains
- Trade-off discussions (option A vs B with consequences)
- Defect reproduction steps when complex

### Format examples

```markdown
❌ WRONG (lost metrics, ambiguous):
| AC-001 | User login works |

❌ WRONG (prose, VN, hard to parse):
Khi user đăng nhập thành công, hệ thống sẽ tạo session token
và lưu vào cookie. Token có thời hạn 24 giờ...

✅ CORRECT (compact + complete):
| AC-001 | Given valid credentials (email + password) | When POST /auth/login | Then issue JWT, TTL=24h, HttpOnly cookie, return 200 |
| AC-002 | Given expired or malformed JWT | When any authenticated request | Then 401 + redirect to /login (preserve intended URL as ?next=) |
| AC-003 | Given 5 failed logins in 15min window | When 6th attempt | Then lock account 30min, audit-log event |
```

### Enforcement

- Reviewer checks artifacts — if critical info missing (no metric where expected, no qualifier for conditional behavior) → flag as defect
- If prose > 30% of file outside allowed sections → quality warning
- **Ambiguity beats brevity as a defect** — downstream agents prefer verbose-but-clear over compact-but-guessable

### Completeness checklist per artifact type

| Artifact | Must include |
|---|---|
| AC rows | ID, actor/precondition, trigger/action, expected outcome, **measurable constraints** (timeouts, limits, codes) |
| BR rows | ID, rule statement, applies-to (roles/scopes), **exception clauses**, source reference |
| NFR rows | Area, requirement, **target metric with unit**, measurement method |
| Dev summary | ACs implemented (by ID), files changed (paths), test status (pass/fail counts), verification exit codes |
| QA report | AC coverage matrix with status, defects (severity + repro + AC ref), evidence type (executed/analytical) |
| Review findings | Finding ID, severity, AC/file ref, **specific fix**, impact if unfixed |

## Context Bundle Standard

Each agent reads **only the files listed for its role**. Reading beyond this set wastes tokens and introduces noise. If a required file is missing, stop and report the gap — do not read alternatives.

`pm` must pass the exact file paths listed below in each subagent invocation prompt.

| Agent | Read these files | Do NOT read |
|---|---|---|
| `ba` | Feature request (from PM prompt only). Phase 2 reads its own `ba/` output internally. | Any pre-existing artifacts |
| `sa` | `ba/00-feature-spec.md`, `ba/02-user-stories.md`, `ba/03-acceptance-criteria.md`, `ba/04-business-rules.md`, `ba/05-nfr.md` + `domain-analyst/00-domain-overview.md`, `domain-analyst/02-bounded-contexts.md`, `domain-analyst/03-aggregates.md`, `domain-analyst/04-domain-events.md` | `ba/01-business-process.md`, `ba/06-open-questions.md`, `ba/07-test-scenarios.md`, DA open-questions, DA data-ownership |
| `designer` | `ba/00-feature-spec.md`, `ba/02-user-stories.md`, `ba/03-acceptance-criteria.md` | SA, TL, or dev artifacts |
| `tech-lead` | `ba/03-acceptance-criteria.md`, `ba/05-nfr.md`, `ba/07-test-scenarios.md`, full `domain-analyst/` folder, full `sa/` folder, `02-designer-report.md` (if exists) | `ba/01-business-process.md`, `ba/06-open-questions.md` |
| `dev` (per task) | `04-tech-lead-plan.md` (assigned task section only), `ba/03-acceptance-criteria.md` (assigned ACs only), `sa/01-system-boundaries.md`, `sa/03-data-architecture.md` | Full SA folder, DA folder, designer report, other dev outputs |
| `fe-dev` (per task) | `04-tech-lead-plan.md` (assigned task section only), `ba/03-acceptance-criteria.md` (assigned ACs only), `02-designer-report.md`, `sa/02-integration-model.md` | Full SA folder, DA folder, BE dev outputs |
| `qa` (per wave) | `ba/03-acceptance-criteria.md`, `ba/07-test-scenarios.md`, `04-tech-lead-plan.md`, `05-dev-w{N}-*.md`, `05-fe-dev-w{N}-*.md` (current wave), `07-qa-report-w{N-1}.md` (prev wave — regression baseline, if N > 1) | Non-current wave dev outputs, SA/DA artifacts |
| `reviewer` | **Path S:** `ba/03-ac`, `04-tech-lead-plan.md`, all `05-dev-*.md`. **Path M:** `ba/03-ac`, `sa/00`, `sa/04`, `04-tech-lead-plan.md`, `07-qa-report.md`, all `05-dev-*.md`. **Path L:** `ba/03-ac`, `sa/00`, `sa/04`, `04-tech-lead-plan.md`, `07-qa-report.md`, all `05-change-digest-w{N}.md` (read raw dev files only if digest is missing). | `ba/01-business-process.md`, DA artifacts, `ba/06-open-questions.md` |
| `devops` | `04-tech-lead-plan.md` (section 4.7 Deployment/Runtime Impact), `sa/05-deployment-model.md` | BA, DA artifacts |
| `security` | `sa/04-security-architecture.md`, `ba/03-acceptance-criteria.md`, `sa/01-system-boundaries.md` | DA artifacts, TL plan |
| `release-manager` | `04-tech-lead-plan.md`, `sa/05-deployment-model.md`, `07-qa-report.md` | BA, DA, designer artifacts |
| `sre-observability` | `sa/02-integration-model.md`, `sa/06-nfr-architecture.md`, `ba/05-nfr.md` | DA artifacts, TL plan |
| `data-governance` | `ba/03-acceptance-criteria.md`, `ba/04-business-rules.md`, `sa/03-data-architecture.md`, `domain-analyst/06-data-ownership.md` | Designer, TL, dev artifacts |

**On-demand reads:** If an agent encounters a gap that requires reading beyond its bundle, it must flag the specific file and reason to PM — not silently read it.

### Context budget

Per-agent: stay under 100K tokens input. If approaching → read only critical bundle files. If > 100K mid-analysis → STOP, return `status: blocked` with `TOKEN-001`.

Prefer lean artifact variants (`ba/00-lean-spec.md` over full 8 files). Don't read files outside your bundle row "to understand context" — bundle is complete by design.

<!-- Why: Tech-lead currently reads ~23 files when it needs ~8. Reviewer reads everything when
     it needs ~7 key files. Context pruning reduces per-invocation input tokens by 30-50%
     for downstream agents without degrading output quality, because agents with focused
     context make fewer hallucinated assumptions about irrelevant upstream decisions. -->

---

## Artifact Directory Structure

Every pipeline produces a persistent artifact trail. Path depends on pipeline type — always read `docs-path` from `_state.md` frontmatter:
- Feature pipeline (`/new-feature`): `docs/features/{feature-id}/`
- Hotfix pipeline (`/hotfix`): `docs/hotfixes/{hotfix-id}/`

```
{docs-path}/                          ← value from _state.md frontmatter
  _state.md                           ← pm: pipeline tracker
  ba/                                 ← ba output (8 files)
  domain-analyst/                     ← domain-analyst output (7-8 files, or 1 file for Path A)
  sa/                                 ← sa output (8 files)
  02-designer-report.md               ← designer (conditional, flat file)
  04-tech-lead-plan.md                ← tech-lead
  05-dev-w{N}-{task-slug}.md          ← dev (one per wave per task)
  05-fe-dev-w{N}-{task-slug}.md       ← fe-dev (if applicable)
  05-change-digest-w{N}.md            ← pm: 10-line change summary per wave (Path M/L only)
  06-devops-report.md                 ← devops (conditional)
  06b-release-manager-report.md       ← release-manager (conditional)
  06c-security-report.md              ← security (conditional)
  06d-sre-report.md                   ← sre-observability (conditional)
  06e-data-governance-report.md       ← data-governance (conditional)
  07-qa-report.md                     ← qa
  08-review-report.md                 ← reviewer
  09-retrospective.md                 ← conditional: risk_score ≥ 3 OR rework_count > 0 OR cycle_time_days > 1
```

See `rules/90-delivery-pipeline.mdc` for the full file listing within each subdirectory.

**Resume interrupted pipeline:** Use `/resume-feature` skill. It reads `_state.md`, reports current stage, distills any conversation context, then hands off to PM to continue autonomously to completion. Do not invoke PM directly for resume — `_state.md` parsing and context distillation happen at the skill level before PM is invoked.

**Modify a completed feature:** Use `/update-feature` skill. It reads existing artifacts as baseline, triages which stages need to re-run, resets `_state.md`, then hands off to PM. Artifacts are overwritten in place — same feature-id, no amendment tracking.

**Each agent checks for its artifact before starting.** If the file exists → resume. If not → start fresh.
