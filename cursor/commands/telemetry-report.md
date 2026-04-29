# /telemetry-report

Aggregate `.cursor/telemetry/{feature-id}.jsonl` to surface real cache hit ratio, token cost, retry density. Recommend ONE actionable optimization.

## Args

`/telemetry-report {feature-id}` — specific feature
`/telemetry-report` — all features (top-level summary)

## Steps

1. Resolve target JSONL file(s):
   - `{feature-id}` arg → `.cursor/telemetry/{feature-id}.jsonl`
   - No arg → glob `.cursor/telemetry/*.jsonl`
2. Read JSONL, parse each line as JSON. Use schema v2 (see resume-feature/SKILL.md § 7b)
3. Aggregate per stage AND per tier (base vs pro):
   - **Cache hit ratio** = `count(cache_signal='hit') / total events`
   - **Gross tokens per stage**: from `token_usage.this_agent_total` — median, p95
   - **Real cost per stage** (see formula below) — median, p95
   - **Cache discount ratio** = `sum(input_cache_read) / sum(input_fresh + input_cache_read)` — higher = better cache utilization
   - **Tier escalation rate** = `count(tier='pro') / total events` per stage
   - **PM escalation count**: `count(event='pm-escalation')`
   - **Rework count**: `count(event='rework')`
   - **Stage duration**: median, p95 (from `duration_s`)
4. Format as 2-table report — Stage table + Cost breakdown table
5. Recommend ONE optimization, citing specific events as evidence (must reference iter+stage+token_usage field)

## Real-cost formula

For each event:
```
real_cost_units = input_fresh × 1.0
                + input_cache_read × 0.1     # ~90% off when cache hits
                + input_cache_write × 1.25   # ~25% premium on first cache write
                + output_text × 5.0          # output rate ~5× input
                + output_reasoning × 5.0     # thinking tokens billed at output rate
                + apply_model × 0.2          # apply uses smaller cheaper model
```

Treat `null` fields as 0 in the formula BUT mark the event as `partial_attribution: true` in output. Aggregate honestly — don't synthesize missing data.

**Per-model rate adjustment** (optional refinement):
- composer-2: divide units by 5 (Cursor pricing — composer is ~1/5 Opus rate)
- claude-sonnet-4-6: divide by 3
- claude-opus-4-7: × 1.0 (baseline)
- gpt-5-codex / gpt-5: × 1.0
- gemini-3-pro: × 1.2
- model field comes from `agent` + lookup in `dispatcher.md` Tier Mapping; if cannot determine → use 1.0 + flag `model_rate_unknown: true`

## Output template

```
## Telemetry Report — {feature-id}

### Stage Activity
| Stage | Iters | Tier mix | Cache hit | Duration (med/p95) |
|---|---|---|---|---|
| ba | 1 | base | n/a (first) | 35s/35s |
| dev-wave-1 | 4 | 3 base / 1 pro | 75% | 142s/210s |
| reviewer | 1 | pro (forced, risk≥3) | 60% | 88s |

### Cost Breakdown (real cost = weighted by cache/output/apply discounts)
| Stage | Gross tokens | Real units | Cache discount | Partial attribution |
|---|---|---|---|---|
| ba | 8,200 | 6,560 | 0% (first) | no |
| dev-wave-1 | 60,700 | 19,720 | 67% | yes (apply=null) |
| reviewer | 92,300 | 51,400 | 30% | yes (reasoning=null) |
| **Total** | **161,200** | **77,680** | avg 32% | — |

Real cost is ~48% of gross — most apparent token volume is cache reads (cheap).

### Pipeline Stats
- PM escalations: 2
- Tier escalations (base→pro): 1 (dev-wave-1 iter 4, confidence:low)
- Reworks: 0

### 🎯 Recommendation
{single actionable item, must cite specific iter+stage+token_usage field as evidence}

Example: "reviewer pulled 92K gross tokens (iter 23) with cache_discount only 30% —
         FROZEN_HEADER may be drifting. Run /cache-audit on agents/reviewer.md
         and reviewer-pro.md to verify byte-identical prefix between base and pro variants.
         Evidence: token_usage.input_cache_read=27K of 90K total (input_fresh=63K)."
```

**Output rules:**
- If ANY stage has all `token_usage` sub-fields = null → mark report header `⚠ partial telemetry — Cursor exposure limited`
- If `model_rate_unknown` events > 30% → footnote with note about rate calibration
- Never invent missing data; always show "n/a" or null clearly

## Constraints

- Read-only. NEVER write JSONL or _state.md.
- If JSONL missing → `Không có telemetry data cho {feature-id}. Pipeline chưa chạy hoặc inline telemetry bị disable.`
- Truncate output if > 30 stages (group oldest into "earlier stages" row)
