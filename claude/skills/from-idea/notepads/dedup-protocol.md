# DEDUP Protocol — Spiral 2

Mandatory protocol for every deliverable surfaced in Spiral 2 Impact Mapping. Enforces CLAUDE.md rule **ST-2** (DEDUP mandatory) backed by **CT 34/CT-TTg Nguyên tắc 6** ("Sử dụng nền tảng số dùng chung — KHÔNG xây lại").

This notepad clones + adapts the strategy-analyst DEDUP pattern (`~/.claude/skills/new-strategic-document/ref-dedup-protocol.md`) for feature-level brainstorm scope.

## Execution mode (MCP-first per CLAUDE.md MCP-2)

Steps run via `etc-platform` MCP when available; local file fallback when MCP down.

| Step | MCP path | Local fallback |
|---|---|---|
| KB read | `mcp__etc-platform__kb_query(domain="ecosystem", max_age_days=90, tags=[...])` | Read `~/.claude/kb/ecosystem/{national-platforms,shared-services,ministry-systems}.md` if exists |
| Pre-check | `mcp__etc-platform__dedup_check({problem, solution_summary})` | Skip (no fallback) |
| Verdict register | `mcp__etc-platform__dedup_register(proposal, verdict, rationale, ecosystem_ref, project_id)` | Skip (no fallback) |
| VN gov research | Agent `policy-researcher` (only if user opted in at Spiral 2 Step 0) | Skip |

If MCP unavailable AND local KB absent: skill warns user "DEDUP gate degraded — KB ecosystem not reachable. Verdicts will rely on user judgment only. Continue or abort?" — user decides.

## Batch optimization (read once, dedup many)

Spiral 2 produces N deliverables (typically 5–15). DO NOT call `kb_query` per deliverable — that's N round trips. Instead:

```
Step A: Read ecosystem context ONCE at Spiral 2 entry (after Goal SMART, before Tier 4 deliverables):
  - mcp__etc-platform__kb_query(domain="ecosystem")  # ~2K tokens cached
  - mcp__etc-platform__kb_query(domain="policy", max_age_days=90)  # only if VN gov context

Step B: For each deliverable in Tier 4:
  - Run 7-question checklist (uses cached context, no extra MCP call)
  - mcp__etc-platform__dedup_check (proposal-specific, fast)
  - Assign verdict locally

Step C: After all deliverables verdicted:
  - mcp__etc-platform__dedup_register batch-call (one call per deliverable, but in single message)
```

## 7-question checklist (per deliverable)

For every deliverable, force user/skill to answer:

```
1. [ ] Is this functionality already on NDXP (National Digital Exchange Platform)?
   → If YES: ADOPT — connect via NDXP module

2. [ ] Is the data already in any CSDLQG (national database)?
   → If YES: ADOPT — query CSDLQG via LGSP, do not store locally

3. [ ] Does any shared service (digital signature, SOC, gov cloud, gov email) cover this?
   → If YES: ADOPT — use shared service

4. [ ] Has the responsible ministry/agency or related ministry already built a similar system?
   → If YES: INTEG — connect via LGSP

5. [ ] Does any national platform have this on roadmap (next 6-12 months)?
   → If YES: consider WAIT + pilot adoption rather than build new

6. [ ] Is there a verified open-source/shared platform for government use?
   → If YES: EXTEND — customize rather than build from scratch

7. [ ] Is this functionality genuinely UNIQUE to this organization?
   → If YES: UNIQUE — proceed but explain why unique
```

For non-VN-gov projects (user said "no" at Spiral 2 Step 0): adapt questions to commercial context — replace NDXP/LGSP/CSDLQG with industry-standard equivalents (SaaS APIs, public APIs, shared infrastructure providers, OSS frameworks).

## Verdict definitions

| Verdict | Trigger | Action on deliverable |
|---|---|---|
| **UNIQUE** | No platform/system covers this functionality | Proceed — keep deliverable as-is |
| **ADOPT** | National/shared platform fully covers | Rewrite as "Implement/connect to [platform]". Cost = integration + training, NOT build-from-scratch |
| **EXTEND** | Platform partially covers, gap exists | Rewrite as "Integrate [platform] + build supplemental [gap]". Cost = adapter + supplemental modules |
| **INTEG** | Other ministry/agency has similar system | Rewrite as "Integrate/exchange data with [system X] via LGSP". Do not build duplicate |
| **REJECT** | Fully duplicate, no value-add | Remove from impact map; explain to user; move to idea-graveyard |

## Confidence on verdict

For every verdict, log confidence:
- `high`: KB exact match (named platform, specific module)
- `medium`: Similar but not identical (broader category match)
- `low`: Best guess based on pattern recognition

Persisted to `dedup-report.md` per deliverable.

## Modify-proposal step (post-verdict)

For non-UNIQUE deliverables, MANDATORY rewrite step:

```
ORIGINAL: <deliverable description>
VERDICT: <UNIQUE | ADOPT | EXTEND | INTEG | REJECT>
PLATFORM/SYSTEM: <name + URL/ref if any>
REWRITTEN: <new description leveraging existing>
COST IMPACT: <% reduction or unchanged + reasoning>
```

Apply **B1 Echo + paraphrase** when presenting rewritten version: confirm user agrees with the rewrite before logging.

## Dedup-report.md output

Write to `{features-root}/_idea/dedup-report.md`:

```markdown
---
type: dedup-report
spiral: 2
created: {ISO}
producer: from-idea
---

# DEDUP Report: {Project Name}

## Summary

- Total deliverables checked: {N}
- Verdicts:
  - UNIQUE: {x}
  - ADOPT: {y}
  - EXTEND: {z}
  - INTEG: {w}
  - REJECT: {v}
- Reuse ratio (y+z+w)/N: {pct}%
- Estimated cost reduction vs all-build: {est}%

## Per-deliverable Detail

### D-1.1.a — {deliverable name}
| Field | Value |
|---|---|
| Original description | {text} |
| KB Search ref | {ecosystem entry / "not found"} |
| Pre-check (MCP) | {prior project ref / "none"} |
| Overlap classification | {exact / partial / planned / none} |
| **Verdict** | **{UNIQUE/ADOPT/EXTEND/INTEG/REJECT}** |
| Confidence | {high/medium/low} |
| Platform / system reference | {name + ref} |
| Rewritten description | {text} |
| Cost impact | {reduction or unchanged + reasoning} |

### D-1.1.b — ...

## Platform usage summary

| Platform | Deliverables integrated | Notes |
|---|---|---|
| NDXP | D-X, D-Y | ... |
| LGSP | D-Z | ... |
| CSDLQG-{name} | D-W | ... |
| ... | ... | ... |

## Lessons (KB_WRITE candidates)

{list new findings worth contributing back to KB ecosystem via mcp__etc-platform__kb_save with consent}
```

## DEDUP gate rule (G2 enforcement)

Spiral 2 Gate G2 MUST block transition to Spiral 3 if:
- Any deliverable lacks verdict → STOP, complete remaining
- Any deliverable has verdict REJECT and is not removed → STOP, force user reframe or remove
- Any deliverable has verdict ADOPT/EXTEND/INTEG and is not rewritten → STOP, complete rewrite

Gate G2 unlocks only when 100% deliverables are validated with verdict + (if applicable) rewrite.

## VN gov dispatch — `policy-researcher` agent

If `_pipeline-state.json#steps.s2.policy_researcher_invoked == true`:

```
dispatch: Agent policy-researcher
  with prompt:
    "Research VN gov shared platforms relevant to deliverables in this impact map.
     Focus: NDXP modules, LGSP services, CSDLQG databases, VNeID integration points,
     ministry-specific systems if applicable to domain {domain_hint}.
     Input: deliverables[] from impact-map.md (only ones with verdict still null).
     Output: per-deliverable platform recommendations with name, ref URL, integration cost ballpark.
     Return: structured table to feed back into 7-question checklist."
```

`policy-researcher` agent uses WebFetch + KB read; from-idea main thread does NOT WebFetch directly.

## Anti-patterns

- Calling `kb_query` per deliverable (use batch mode — read once at Spiral 2 entry)
- Skipping DEDUP because user says "tôi biết là unique" — DEDUP is mandatory regardless of user assertion
- Using `dedup_register` without `contributor_consent=True` and pre-redaction
- Calling `policy-researcher` without explicit user opt-in (Spiral 2 Step 0)
- Letting REJECT verdict persist without removing or reframing the deliverable
- Treating rewrite as optional — every non-UNIQUE deliverable MUST be rewritten before Gate G2
