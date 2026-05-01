---
parent: _state.md
phase: 2
applied-at: 2026-05-01
status: applied — awaiting measurement
---

# Phase 2 — Force composer-2 (Applied)

## Changes

### File 1: `~/.cursor/skills/resume-feature/SKILL.md`

**Step 7 dispatcher loop**:
```diff
- result = Task(dispatcher, prompt)
+ result = Task(dispatcher, prompt, model="composer-2")
```

**PM escalation Task call**:
```diff
- pm_result = Task(pm, PM_FROZEN + "\n\n" + pm_dynamic)
+ pm_result = Task(pm, PM_FROZEN + "\n\n" + pm_dynamic, model="composer-2")
```

### File 2: `~/.cursor/agents/dispatcher.md`

**Specialist dispatch (function `dispatch_stage`)**:
```diff
- result = Task(subagent_type=agent)
+ result = Task(subagent_type=agent, model="composer-2")

- result = Task(subagent_type=role + "-pro")
+ result = Task(subagent_type=role + "-pro", model="composer-2")
```

Plus added explanatory note about Cursor 3 bug 151917 (`model:` parameter sometimes ignored — backup via Cursor Settings UI).

## Why composer-2 mọi nơi

Spike F-003 cho thấy `claude-4.6-sonnet-medium-thinking` chiếm **64% chi phí** ($3.11/$4.88) chỉ vì 5/12 events. Cursor "auto" route lên thinking khi prompts phức tạp.

Tier routing pipeline KHÔNG dựa vào model power — dựa vào AGENT FILE (`{role}.md` vs `{role}-pro.md`), tức prompt + instructions khác. Cùng underlying model, *-pro variant rigorous hơn.

## Backup nếu Cursor ignore `model:` param

User cần cấu hình Cursor Settings UI:
- Settings → Models → Default model → **composer-2**
- Settings → Models → "Auto" toggle → **OFF** (nếu có option này)

→ Nếu Task() param fail, default vẫn fallback về composer-2.

## Reversibility

```bash
# Revert SKILL.md
sed -i 's/, model="composer-2")/)/g' ~/.cursor/skills/resume-feature/SKILL.md

# Revert dispatcher.md (manual — 2 occurrences)
# Edit lines 134, 140 in ~/.cursor/agents/dispatcher.md
```

## Expected impact

Theo F-003 spike data:
- Pre-Phase 2: 5 thinking events × $0.62 avg = $3.10 (64% probe cost)
- Post-Phase 2 (composer-2): equivalent events ~$0.21 each (composer-2 avg)
- **Saving estimate: 50-65% per Task() event**

Combined Phase 1A + 1B + 2:
- F-003 baseline cost $4.88
- Target: **$1.20 - $1.80** for equivalent feature

## Quality risks

| Risk | Mitigation |
|---|---|
| Composer-2 quality drop on complex stages | *-pro escalation via agent file (different system prompt) — preserved |
| Reviewer/SA may need reasoning | Path L still routes through *-pro variants (more rigorous prompts) |
| Long planning steps suffer | Spike scenarios are short Path S — risk low for measurement |

If F-005 spike shows quality drop:
- Add stage-specific exception: e.g. `if stage == "sa": model = "auto"` for high-risk
- Or accept slightly longer rework loops (composer-2 retry × 2 still cheaper than thinking × 1)

## Measurement

**Skip dedicated Phase 2 measurement.** Run F-005 probe combining all phases (1A + 1B + 2) for cleanest comparison.

## Next: Phase 3 — Bundle inlining

Convert resume-feature Step 6.5 from "describe algorithm" to "executable Action steps". Goal: actually inline file contents into Task() prompts so subagents skip re-reads.

Then F-005 spike to validate combined effect.
