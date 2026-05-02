---
name: arch-review
description: Khảo sát toàn bộ kiến trúc dự án và đăng ký nợ kỹ thuật. Có 2 chế độ - review (phân tích kiến trúc hiện tại để đánh giá điểm mạnh/yếu) và tech-debt (kiểm kê và xếp ưu tiên các vấn đề tồn đọng cần xử lý). Phạm vi system-wide, không phải 1 PR. Trigger - định kỳ quarterly review kiến trúc; chuẩn bị refactor lớn; onboard SA mới cần map current state; build tech-debt backlog. Anti-trigger - review code 1 PR thì /quality review; review 1 quyết định kiến trúc thì /adr; điều tra trước khi quyết hướng đi thì /spike. Example - "/arch-review review" hoặc "/arch-review tech-debt".
disable-model-invocation: true
---

# Architecture Review

Absorbs: tech-debt.
Modes: `review` (default) | `tech-debt`.
User-facing output: Vietnamese.

Mode detection:
- "arch review", "architecture", "module map", "anti-patterns" → `review`
- "tech debt", "code health", "refactor priority" → `tech-debt`

For `tech-debt` mode: Task(tech-lead) identifies debt items + Task(reviewer) assesses impact → output `{project-path}/docs/architecture/tech-debt-{date}.md` with severity, effort, priority ranking. Then show "What's next" suggesting `/code-change refactor` for top items.

For `review` mode (default): proceed with architecture survey below.

---

## Input — collect upfront

Ask the user for the following. Do NOT proceed until all are provided:

1. **Scope** — Full codebase | Specific module/service: {name} | Specific concern: {e.g. "auth flow", "data layer", "API boundaries"}
2. **Analysis depth** — `overview` (high-level map + top issues) | `deep` (full anti-pattern audit + improvement roadmap)
3. **Focus areas** — All | Module boundaries | Coupling | Data flow | Security boundaries | Performance hotspots
4. **Context** — why is this analysis needed? (planning new feature / pre-refactor / architecture review / new team member)

Generate an `arch-id`: `arch-{YYYYMMDD}-{short-slug}`.

---

## Orchestration

SA surveys codebase using NX MCP + SemanticSearch → produces architecture report.

```
Task(
  subagent_type="pm",
  prompt="## Architecture Analysis

arch-id: {arch-id}
scope: {full|module|concern}
depth: {overview|deep}
focus: {focus areas}
context: {why this analysis}
output-path: docs/architecture/{arch-id}.md

## Instructions
Run fully autonomously. Do NOT ask the user any questions.

### Step 0 — MCP discovery
Call ListMcpResources. Record as {available_mcps}.
If NX MCP available: call get_project_graph — this is the primary input for architecture mapping.
If DB MCP available: query information_schema for data architecture analysis.

### Step 1 — SA: architecture survey
Task(
  subagent_type='sa',
  prompt='## Architecture Analysis

  arch-id: {arch-id}
  scope: {scope}
  depth: {depth}
  focus: {focus areas}
  context: {context}
  available-mcps: {available_mcps}
  nx-project-graph: {full nx graph JSON if available}

  MCP instruction: NX project graph is your PRIMARY source — use it before reading files. If DB MCP available, query schema for data architecture. If Context7 available, use for any framework/library patterns being evaluated.

  Produce a complete architecture analysis:

  ## 1. Module Inventory
  List every project/library/service with:
  - Name, type (app/lib/service), primary responsibility
  - Tech stack (framework, DB, external deps)
  - Inbound dependencies (what depends on it)
  - Outbound dependencies (what it depends on)

  ## 2. Dependency Graph Summary
  - Overall shape (monolith / modular monolith / microservices / hybrid)
  - Circular dependencies (if any)
  - God modules (depended on by >50% of others)
  - Orphan modules (no dependents, no clear owner)

  ## 3. Layer Analysis
  - Architectural layers (presentation / application / domain / infrastructure)
  - Layer boundary violations (list each)
  - Data flow direction between layers

  ## 4. Anti-patterns Found
  | Anti-pattern | Location | Severity (High/Med/Low) | Impact | Recommended fix |
  |---|---|---|---|---|

  Anti-patterns to check: God class/module | Circular dependency | Layer violation | Anemic domain model | Spaghetti dependency | Shared mutable state | Missing abstraction | Dead code

  ## 5. Strengths
  What is architecturally well-designed? (be specific)

  ## 6. Improvement Roadmap (deep depth only)
  | Priority | Improvement | Effort | Impact | Approach |
  |---|---|---|---|---|

  ## 7. Architecture Fitness Score
  Rate on each dimension (1-5):
  - Modularity: {score} — {justification}
  - Testability: {score} — {justification}
  - Maintainability: {score} — {justification}
  - Scalability: {score} — {justification}
  - Security boundary clarity: {score} — {justification}

  overall: {average}/5
  '
)

### Step 2 — Write architecture report
Task(
  subagent_type='dev',
  prompt='Write to docs/architecture/{arch-id}.md:

---
arch-id: {arch-id}
scope: {scope}
date: {date}
depth: {depth}
fitness-score: {X}/5
anti-pattern-count: {N}
---

# Architecture Analysis: {arch-id}

## Scope and Context
{scope and why this analysis was done}

## Module Inventory
{full module table}

## Dependency Structure
{dependency graph description and key observations}

## Layer Analysis
{layer structure and violations}

## Anti-patterns Found ({N})
{full anti-pattern table with severity}

## Architectural Strengths
{what is working well}

## Fitness Score
{score table with justifications}

## Improvement Roadmap
{prioritized table — or "Overview depth: run /arch-review with depth=deep for full roadmap"}
  '
)

### Step 3 — Respond to user (in Vietnamese)
format:
## Architecture Analysis Complete: {arch-id}

**Scope:** {scope}
**Fitness score:** {X}/5
**Anti-patterns found:** {N} ({High count} high severity)

**Top issues:**
{top 3 anti-patterns by severity}

**Strengths:**
{top 1-2 strengths}

{If fitness < 3: '⚠️ Điểm kiến trúc thấp — xem xét /spike để lập kế hoạch cải thiện trước khi thêm tính năng lớn.'}
{If depth=overview: 'Chạy /arch-review với depth=deep để có roadmap cải thiện đầy đủ.'}

report: docs/architecture/{arch-id}.md

## Stop condition
Run to completion. If NX MCP is not available and codebase is very large, limit analysis to the specified scope only.
"
)
```

## ▶ What's next?

```
if anti_patterns_high_severity > 0 AND fitness_score <= 2:
  → Auto-invoking: /adr
    Critical architectural findings must be recorded as decisions before any feature work.
    Review at {project_path}/docs/architecture/{arch-id}.md passed as context.
  After /adr completes:
  → Suggested: /spike "{top anti-pattern topic}"
    reason: low fitness score — investigate improvement approach before next feature.
    Run now? (yes / skip)

elif anti_patterns_high_severity > 0 AND fitness_score in [3, 4]:
  → Suggested: /adr
    reason: high-severity findings should be recorded as architectural decisions.
    Run now? (yes / skip)
  → Also suggested: /arch-review tech-debt
    reason: anti-patterns found — register as tech debt for prioritization.
    Run now? (yes / skip)

elif anti_patterns_high_severity == 0 AND fitness_score == 5:
  → No action required. Architecture is healthy.
    suggested: /new-feature — safe to continue feature development.

elif depth == "overview":
  → Suggested: /arch-review depth=deep
    reason: overview scan only — run deep analysis for full improvement roadmap.
    Run now? (yes / skip)
```
