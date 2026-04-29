# Task() Invocation Pattern — Generic Template

## Structure

All Task() invocations use four sections. The first two are static (cache-eligible); the last two are dynamic (change per invocation).

```
Task(subagent_type="{agent-name}", prompt="
## Agent Brief
role: {agent-name} | pipeline-path: {S|M|L} | output-mode: lean | stage: {stage-name} | artifact-file: {agent-name}/{artifact-filename}.md

## Project Conventions
docs-path: {docs-path} | feature-id: {feature-id}

## Inputs
{context-files — relevant sections only, not full artifacts}
{handoff contract from previous agent's output}
{any ownership boundaries or scope constraints}
")
```

## Rules

- `## Agent Brief` + `## Project Conventions` = static prefix, identical across invocations for the same feature → cache-eligible
- `## Inputs` = dynamic — pass only the sections relevant to this agent's stage (not full artifacts)
- If input artifact exceeds ~8000 tokens, distill to relevant sections + always include the Handoff Contract section
- For parallel invocations: each agent gets its own `artifact-file` name and its own ownership boundary in `## Inputs`

## Placeholders

| Placeholder | Example value |
|---|---|
| `{agent-name}` | `ba`, `sa`, `dev`, `fe-dev`, `qa`, `reviewer`, `devops` |
| `{docs-path}` | `.cursor/docs/feat-42/` |
| `{feature-id}` | `feat-42` |
| `{stage-name}` | `requirements`, `architecture`, `development`, `qa`, `review` |
| `{artifact-filename}` | `00-lean-spec`, `04-tl-plan`, `05-dev-w1` |
| `{context-files}` | Sections from `ba/00-lean-spec.md`, `sa/02-arch.md`, `04-tl-plan.md` |
