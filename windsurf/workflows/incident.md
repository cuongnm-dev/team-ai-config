---
description: Production incident response workflow. Triage severity → communicate → fix → postmortem. Loads engineering-incident-response skill. Trigger - "production is down", "we have an incident", critical alerts.
---

# /incident {description}

Loads `engineering:incident-response` skill (Cascade auto-load).

## Phase 1 — Triage (first 5 min)

```
## Severity Assessment
Q1: User impact (% affected)?
Q2: Data integrity at risk?
Q3: Security breach indicators?
Q4: Revenue impact?

→ Severity:
   SEV1 (Critical) — outage / data loss / security breach
   SEV2 (High) — major feature broken
   SEV3 (Medium) — degraded but functional
   SEV4 (Low) — minor issue
```

## Phase 2 — Communicate

| Severity | Notify |
|---|---|
| SEV1 | Engineering lead + ops + stakeholders + status page UPDATE |
| SEV2 | Engineering lead + ops |
| SEV3 | Team channel |
| SEV4 | Track in backlog |

Generate status update template:
```
**Incident:** {description}
**Severity:** SEV{N}
**Started:** {timestamp}
**Impact:** {user-facing description}
**Status:** Investigating | Identified | Mitigating | Resolved
**ETA:** {if known}
**Updates:** Every 30 min until resolved
```

## Phase 3 — Diagnose

Loads `engineering:debug` skill. Reproduce → isolate → diagnose.

Use `mcp__github` to check recent PRs, `mcp__fetch` for logs/dashboards if URLs available.

## Phase 4 — Mitigate

Options ranked:
1. Rollback last release
2. Feature flag toggle
3. Hotfix (route to `/hotfix` for proper pipeline)
4. Manual workaround + scheduled fix

## Phase 5 — Verify

- Reproduce gone in production
- Affected users notified resolution
- Status page updated to Resolved
- Monitoring confirms healthy

## Phase 6 — Postmortem (SEV1/SEV2 mandatory)

Save to `docs/incidents/{date}-{slug}.md`:

```markdown
# Incident Postmortem: {title}

## Summary
{1-paragraph}

## Timeline (UTC)
| Time | Event | Owner |

## Root Cause Analysis
5 whys:
1. Why X happened? Because Y.
2. Why Y? Because Z.
...

## Contributing Factors
- ...

## What Went Well
- ...

## What Didn't Go Well
- ...

## Action Items
| Item | Owner | Due | Tracked in |

## Lessons Learned
{narrative}

## Severity Reduction Plan
{what would have caught this earlier}
```

Blameless framing — focus on system, not individuals.

## What's next

| Severity | Next |
|---|---|
| SEV1/2 + resolved | `/runbook` to document recovery |
| SEV3 + workaround | Schedule proper fix via `/code-change` or `/hotfix` |
| Pattern detected | `/arch-review` if architectural |
