---
name: spike
description: Điều tra kỹ thuật khi chưa rõ giải pháp — chạy trước khi mở pipeline triển khai chính thức. Kiến trúc sư (SA) đánh giá điểm chưa rõ về kiến trúc, tech-lead đánh giá điểm chưa rõ về triển khai, dev (tùy chọn) làm thử proof-of-concept để chứng minh khả thi. Output là tài liệu khảo sát có khuyến nghị rõ ràng.
---

# Spike

**Output language: Vietnamese.**

---

## Input — collect upfront before invoking PM

Ask the user for the following. Do NOT proceed until all are provided:

1. **Problem statement** — what is unknown or uncertain
2. **Question to answer** — what specific question this spike must answer
3. **Timebox** — how many days maximum to spend on this investigation
4. **Affected area** — which services, modules, or tech stack components are involved
5. **Success criteria** — how do you know the spike is done? (e.g. "we know which approach to use", "we have a working PoC")
6. **PoC needed?** — does dev need to write a proof of concept, or is analysis enough?

Generate a `spike-id`: `spike-{YYYYMMDD}-{short-slug}` (e.g. `spike-20260327-realtime-sync`).

---

## Orchestration

PM orchestrates sequentially: SA → tech-lead → [dev if PoC needed]. PM assembles final spike document and saves it.

```
Task(
  subagent_type="pm",
  prompt="## Spike Investigation

spike-id: {spike-id}
output-path: docs/spikes/{spike-id}.md
poc-needed: {yes|no}

## Problem Statement
{problem statement}

## Question to Answer
{spike question}

## Timebox
{N days}

## Affected Area
{services / modules / tech stack}

## Success Criteria
{success criteria}

## Instructions
Run the spike workflow fully autonomously. Do NOT ask the user any questions.

### Step 0 — MCP discovery (before invoking any agent)
Call `ListMcpResources`. Record results as `{available_mcps}`. Pass this list in every subsequent agent prompt below.
If empty, set `{available_mcps}` to "none".

### Step 1 — SA: Architectural investigation
Task(
  subagent_type='sa',
  prompt='## Spike — Architectural Investigation

  spike-id: {spike-id}
  question: {spike question}
  Affected area: {affected area}
  timebox: {N days}
  available-mcps: {available_mcps}

  MCP instruction: If Context7 MCP is in available_mcps, call it to get current library docs for any technology being evaluated. If DB MCP is available, query schema before proposing data architecture options.

  Investigate and produce:
  1. What architectural patterns apply to this problem
  2. Known constraints and non-negotiables
  3. Option A / Option B / Option C — brief description of each viable approach
  4. For each option: pros, cons, architectural risk
  5. Recommended option — with justification
  6. Remaining unknowns after this analysis
  7. What tech-lead must validate at the implementation level

  Format as structured markdown. No fluff.'
)

### Step 2 — Tech-lead: Implementation investigation
Task(
  subagent_type='tech-lead',
  prompt='## Spike — Implementation Investigation

  spike-id: {spike-id}
  question: {spike question}
  SA recommended approach: {SA recommendation}
  SA remaining unknowns: {SA unknowns}
  available-mcps: {available_mcps}

  MCP instruction: If NX MCP is in available_mcps, call get_project_graph to understand actual module boundaries before estimating complexity. If Context7 MCP is available, use it to evaluate libraries/frameworks mentioned in the spike.

  Investigate and produce:
  1. Implementation feasibility for SA recommended approach
  2. Estimated complexity (story points if this were a real feature)
  3. Known pitfalls or traps in this area
  4. Libraries, frameworks, or tools to evaluate
  5. What a PoC must prove (if PoC is needed)
  6. Decision: Proceed with SA recommendation | Modify approach | Investigate further
  7. If PoC needed: exact scope of PoC (minimum to answer the spike question)'
)

### Step 3 — Dev: Proof of concept (only if poc-needed=yes)
If poc-needed is yes:
Task(
  subagent_type='dev',
  prompt='## Spike — Proof of Concept

  spike-id: {spike-id}
  PoC scope: {tech-lead PoC scope}
  Question to answer: {spike question}
  Success criteria: {success criteria}
  available-mcps: {available_mcps}

  MCP instruction: If Context7 MCP is in available_mcps, use it for library API docs before writing PoC code. If NX MCP is available, use get_project_graph to find the correct project to write the PoC into.

  Write the minimal code needed to answer the spike question.
  - Do NOT build production-quality code
  - Focus only on proving the feasibility / answering the question
  - Document findings inline with comments
  - Conclude with: Does this PoC answer the spike question? Yes/No/Partially — and why'
)

### Step 4 — Assemble spike document
Collect outputs from SA, tech-lead, and dev (if PoC). Assemble the spike document.
Delegate file writing to dev:
Task(
  subagent_type='dev',
  prompt='Write to docs/spikes/{spike-id}.md:

---
spike-id: {spike-id}
question: {spike question}
status: complete
recommendation: {final recommendation}
created: {date}
---

# Spike: {spike-id}

## Question
{question}

## SA Findings
{SA analysis and recommendation}

## Tech-lead Findings
{tech-lead implementation analysis}

## PoC Results
{dev PoC findings — or "PoC not required"}

## Recommendation
{clear recommendation: proceed with X / do not proceed / investigate further}

## Next Step
{if proceed: use /new-feature or /estimate}
{if do not proceed: reason}
{if investigate further: what specifically needs more investigation}
  '
)

### Step 5 — Respond to user (in Vietnamese)
format:
## Spike Complete: {spike-id}

**Question:** {spike question}
**Recommendation:** {recommendation}

**SA finding:** {1-line summary}
**Tech-lead finding:** {1-line summary}
**PoC result:** {1-line summary or 'Not required'}

**Next step:** {concrete action}

Spike document saved: docs/spikes/{spike-id}.md

## Stop condition
Only stop mid-flow if the spike question cannot be answered without external access
(e.g. requires reading a third-party vendor API that is not available).
In that case, document what was found so far and flag the specific gap to the user.
"
)
```

## ▶ What's next?

```
if recommendation == "proceed" AND architectural_decision_found == true:
  → Auto-invoking: /adr
    Architectural decision discovered during spike must be recorded before implementation.
    Spike doc at {project_path}/docs/spikes/{spike-id}.md passed as context.
  After /adr completes:
  → Suggested: /plan
    reason: spike answered the question — plan the implementation now.
    Run now? (yes / skip)

elif recommendation == "proceed" AND architectural_decision_found == false:
  → Suggested: /plan
    reason: spike answered the question — implementation approach is clear.
    Run now? (yes / skip)

elif recommendation == "do not proceed":
  → Stopped. Spike recommends against this approach.
    findings: {summary of why}
    alternative: {suggestion from spike doc if any}

elif recommendation == "investigate further":
  → Stopped. Additional investigation needed.
    gap: {what specific information is missing}
    Suggested action: {contact vendor / get environment access / run PoC phase 2}
```
