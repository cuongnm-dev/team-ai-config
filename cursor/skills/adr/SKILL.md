---
name: adr
description: Ghi chép lại một quyết định kiến trúc quan trọng (Architecture Decision Record). Có 2 mức độ: full (kiến trúc sư cùng tech-lead xác nhận, dùng cho quyết định lớn) và quick (kiến trúc sư tự ghi, dùng cho quy ước nhỏ). Skill tự chọn mức phù hợp hoặc hỏi user nếu chưa rõ.
---

# Architecture Decision Record

**Output language: Vietnamese.**

## Mode Selection

If user specifies mode explicitly (`/adr quick` or `/adr full`) → use that mode.

Otherwise, ask:
> "Quyết định này thuộc loại nào?
> 1. **Full** — quan trọng, ảnh hưởng nhiều module/team, cần tech-lead validate
> 2. **Quick** — convention nhỏ, đã rõ ràng, chỉ cần ghi lại nhanh"

If the decision is architecturally significant, controversial, or has high blast radius → recommend Full.

## Input — collect upfront

Ask the user for:
1. **Decision title** — short name (e.g. "Use event sourcing for order history")
2. **Context** — what problem forces this decision?
3. **Decision made** — what was decided?
4. **Alternatives considered** — other options evaluated (brief)
5. **Consequences** — known trade-offs
6. **Related** — feature-id, spike-id, or PR (optional)

Auto-generate `adr-id` from existing ADRs in `docs/decisions/` (next sequential: `ADR-001`, `ADR-002`...).

## Mode: Full (SA + Tech-lead)

```
Task(
  subagent_type="pm",
  prompt="## Architecture Decision Record (Full)

adr-id: {adr-id}
output-path: docs/decisions/{adr-id}-{slug}.md
related: {related-id or 'none'}

title: {title}
context: {context}
decision: {decision}
alternatives: {alternatives}
consequences: {consequences}

## Instructions
Run fully autonomously.

### Step 1 — SA: write ADR
Task(subagent_type='sa', prompt='Write complete ADR with sections: Status (Accepted), Context, Decision, Alternatives Considered (name/pros/cons/why rejected per option), Consequences (Positive/Negative/Neutral), Compliance, Review Trigger. Frontmatter: adr-id, title, date, status:Accepted, deciders:[SA,Tech Lead], related.')

### Step 2 — Tech-lead: validate
Task(subagent_type='tech-lead', prompt='Review ADR. Add: implementation implications, patterns that must change, existing code to update, technical risks. Verdict: Endorse | Endorse with caveats | Escalate.')

### Step 3 — Save
Merge tech-lead caveats into SA draft. Delegate to dev:
- Write docs/decisions/{adr-id}-{slug}.md
- Update docs/decisions/INDEX.md (append row; create with header if missing)

### Step 4 — Respond (Vietnamese)
report: adr-id, title, tech-lead verdict, 1-line summary, saved path.
Stop if tech-lead Escalates — surface concern to user.
"
)
```

## Mode: Quick (SA only, no tech-lead)

```
Task(
  subagent_type="pm",
  prompt="## Architecture Decision Record (Quick)

adr-id: {adr-id}
output-path: docs/decisions/{adr-id}-{slug}.md
related: {related-id or 'none'}

title: {title}
context: {context}
decision: {decision}
alternatives: {alternatives}
consequences: {consequences}

## Instructions
Run fully autonomously. No tech-lead step.

### Step 1 — SA: write concise ADR
Task(subagent_type='sa', prompt='Write concise ADR: Status (Accepted, type:lightweight), Context, Decision, Alternatives (name + why rejected, one line each), Consequences (Positive/Negative), Review Trigger.')

### Step 2 — Save
Delegate to dev:
- Write docs/decisions/{adr-id}-{slug}.md
- Update docs/decisions/INDEX.md (append row with type=lightweight)

### Step 3 — Respond (Vietnamese)
report: adr-id, title, type:lightweight, saved path.
If decision seems significant: suggest upgrading to /adr full.
"
)
```

## ▶ What's next?

| Kết quả | Skill tiếp theo |
|---|---|
| ADR approved | `/new-feature` — implement decision |
| ADR cần SA validation | Invoke `sa` agent để review architecture |
| Decision affects security | `/compliance-check` — verify compliance implications |
| ADR supersedes cũ | Update existing ADR file, không tạo mới |
