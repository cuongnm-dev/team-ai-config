# Inline telemetry (zero sub-agent token cost)

Loaded on demand by `resume-feature` Step 7 dispatcher loop after each Task() result.

---

## Why inline Bash printf

After every dispatcher result, the **skill itself** appends ONE line to `.cursor/telemetry/{feature-id}.jsonl` via the Bash tool — no Task() spawn. Saves ~10-25K tokens per feature. Anomaly detection deferred to `/telemetry-report` aggregation pass.

**Why Bash + printf instead of agent**:
- Cursor skills are LLM instructions; the agent invokes tools (Bash, Edit, Write)
- A 1-line printf is ~50 tokens vs ~500 tokens for sub-agent invocation overhead
- Race-safe via shell append (`>>`) — atomic on POSIX, OK on Windows for single-line writes

---

## Implementation contract

Skill instructs main agent to call Bash with this template. Use `jq` to safely build JSON (handles quote-escaping). If `jq` not installed → fall back to printf with manual quote-escape.

**Primary template (jq, preferred):**
```bash
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p .cursor/telemetry
jq -nc \
  --arg ts "$ts" \
  --arg fid "{feature_id}" \
  --arg ev "{event}" \
  --arg stg "{stage}" \
  --arg ag "{agent}" \
  --arg tier "{tier}" \
  --arg vd "{verdict}" \
  --arg cs "{cache_signal}" \
  --argjson it {iter} \
  --argjson dur {duration_s} \
  --argjson tu '{token_usage_json_block}' \
  '{ts:$ts, feature_id:$fid, event:$ev, stage:$stg, agent:$ag, tier:$tier, iter:$it, verdict:$vd, duration_s:$dur, cache_signal:$cs, token_usage:$tu}' \
  >> .cursor/telemetry/{feature_id}.jsonl
```

`{token_usage_json_block}` is the verdict's `token_usage` object verbatim (skill copies it from agent verdict — see ref-pm-standards.md § Token Tracking Standard v2).

**Fallback template (printf, if jq absent):**
```bash
ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p .cursor/telemetry
verdict_esc=$(printf '%s' "{verdict}" | sed 's/"/\\"/g')
printf '{"ts":"%s","feature_id":"%s","event":"%s","stage":"%s","agent":"%s","tier":"%s","iter":%d,"verdict":"%s","duration_s":%d,"cache_signal":"%s","token_usage":%s}\n' \
  "$ts" "{feature_id}" "{event}" "{stage}" "{agent}" "{tier}" {iter} "$verdict_esc" {duration_s} "{cache_signal}" '{token_usage_json_block}' \
  >> .cursor/telemetry/{feature_id}.jsonl
```

---

## JSONL event schema (v2 — full breakdown)

```json
{
  "ts": "ISO-8601 UTC",
  "feature_id": "F-042",
  "event": "stage-complete | pm-escalation | rework | blocker | done | escalate-tier",
  "stage": "dev-wave-1",
  "agent": "dev | dev-pro | qa | qa-pro | reviewer | reviewer-pro | sa | sa-pro | ba | ba-pro | tech-lead | pm | ...",
  "tier": "base | pro",
  "iter": 7,
  "verdict": "Pass",
  "duration_s": 142,
  "cache_signal": "hit | miss | unknown",
  "token_usage": {
    "input_fresh": 12500,
    "input_cache_read": 45000,
    "input_cache_write": null,
    "output_text": 3200,
    "output_reasoning": null,
    "apply_model": null,
    "this_agent_total": 60700,
    "pipeline_total": 89200
  }
}
```

---

## Skill loop responsibility

1. After each Task() returns → extract `result.verdict.token_usage` (full block, not just total)
2. Build telemetry JSONL line via jq template
3. Append to `.cursor/telemetry/{feature_id}.jsonl`
4. Update `_state.md.kpi.tokens_total` from `token_usage.pipeline_total`

**Tier field**: derive from agent name suffix — `*-pro` → `"pro"`, else `"base"`. Allows `/telemetry-report` to compute per-tier cost split.

**JSON-escape rule**: only `verdict` field is free-text from agent — use jq's `--arg` (auto-escapes) OR sed `s/"/\\"/g` in fallback. All other fields are controlled enums (event, stage, cache_signal) or numbers.

**Cache signal heuristic** (computed by skill before Bash call, no model needed):
- Track `frozen_header_hash` in skill memory at loop init
- Track `first_run_duration` after iter=1 completes
- Compute `cache_signal`:
  - `hit` if `iter > 1` AND header hash unchanged AND `duration_s < first_run_duration × 0.6`
  - `miss` if `iter == 1` OR header hash changed
  - `unknown` otherwise

---

## Failure mode + aggregation

**Failure mode**: If Bash fails (disk full, permission), skill prints `[telemetry-degraded] {error}` to console, continues pipeline. Telemetry is never on the critical path.

**Aggregation deferred** to `/telemetry-report` slash command (see `commands/telemetry-report.md`). When user wants insight, that command loads JSONL with appropriate analysis model — anomalies surfaced lazily, with full historical context.

**`agents/telemetry.md` retained** for advanced cross-feature root-cause analysis only. Default per-iter flow = inline Bash printf. NEVER invoke Task(telemetry) in dispatcher loop.
