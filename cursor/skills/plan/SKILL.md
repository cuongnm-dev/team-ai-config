---
name: plan
description: Khảo sát phạm vi công việc, ước lượng effort, lập kế hoạch triển khai. 3 chế độ: estimate (chỉ ước lượng thời gian/effort), plan (lập kế hoạch chi tiết các bước), breakdown (chia nhỏ tính năng thành các task có thể giao cho dev).
---

# Plan

Replaces: plan-feature, estimate, breakdown.
Modes: `estimate` | `plan` | `breakdown` (auto-detected or user-specified).
User-facing output: Vietnamese.

## Mode detection

| Signal | Mode |
|---|---|
| "estimate", "how long", "effort", "cost" | estimate |
| "plan", "implementation plan", "how to build" | plan |
| "breakdown", "tasks", "backlog", "AC from spec" | breakdown |
| Ambiguous | Ask user |

## Common preamble

1. Read `AGENTS.md` → repo-type, project structure
2. If feature-id provided → read `_state.md` for existing scope
3. Scan relevant codebase areas (Glob + Grep for impacted modules)

---

## Mode: estimate

BA light-scope + tech-lead effort. No code, no implementation plan.

steps:
1. Task(ba) → scope: modules, features, actors, business rules count
2. Task(tech-lead) → effort: complexity factors, t-shirt size (S/M/L/XL), day ranges, risk

output: `{project-path}/docs/plans/{slug}-estimate.md`

sections: Scope summary | Complexity factors | Effort estimate | Risk factors | Recommended path (S/M/L)

## Mode: plan

SA architecture survey + tech-lead implementation plan.

steps:
1. Task(sa) → identify impacted modules, boundaries, contracts, integration points
2. Task(tech-lead) → implementation plan: task sequence, dependencies, wave structure

output: `{project-path}/docs/plans/{slug}.md`

sections: Architecture context | Impacted modules | Task list with dependencies | Wave plan | Risk mitigations

## Mode: breakdown

Extract ACs from spec/doc → create actionable task backlog.

input: URD, BA spec, PRD, or requirements document (file path or inline)

steps:
1. Task(ba) → extract user stories, ACs (`AC-NNN`), business rules (`BR-NNN`), NFRs
2. Task(tech-lead) → map ACs to tasks (`W{N}-T{N}`), estimate per task, sequence waves

output: `{project-path}/docs/plans/{slug}-tasks.md`

sections: User stories + ACs | Business rules | Task breakdown by wave | Effort summary

---

## What's next

| Outcome | Next |
|---|---|
| Estimate approved | `/new-feature` with path recommendation |
| Plan ready | `/new-feature` or `/implement` |
| Breakdown done | `/new-feature` with pre-populated feature-req |
