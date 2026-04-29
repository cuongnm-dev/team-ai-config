# ref-checklist.md — Verification Checklist (Claude Code)

Chạy checks sau scaffold. Tất cả phải PASS.

---

## Workspace Scaffold Checks

### Check 1: Claude Code Agents (6 required)

```bash
# Strategic agents
ls ~/.claude/agents/strategy-analyst.md
ls ~/.claude/agents/policy-researcher.md
ls ~/.claude/agents/structure-advisor.md

# Doc pipeline agents
ls ~/.claude/agents/doc-orchestrator.md
ls ~/.claude/agents/doc-writer.md
ls ~/.claude/agents/doc-reviewer.md
```

Pass: All 6 exist.

### Check 2: CLAUDE.md

```bash
head -5 ~/.claude/CLAUDE.md
grep -c "ST-1\|ST-2\|KB-1\|KB-2" ~/.claude/CLAUDE.md
```

Pass: File exists, contains strategic + KB rules.

### Check 3: Skill

```bash
ls ~/.claude/skills/new-strategic-document/SKILL.md
```

Pass: Exists with `Agent tool` orchestration pattern.

### Check 4: Knowledge Base (≥ 10 seed files)

```bash
find knowledge-base/ -type f | wc -l
```

Required files:
- `_kb_index.md`
- `ecosystem/national-platforms.md`
- `ecosystem/shared-services.md`
- `policy/_active-policies.md`
- `policy/qd-749.md`
- `policy/ct-34.md`
- `precedent/_patterns.md`
- `tech/integration-patterns.md`
- `tech/cost-benchmarks.md`
- `glossary/vn-gov-it.md`

### Check 5: Outline (MUTABLE)

```bash
grep "MUTABLE" templates/outlines/de-an-cds-reference.md
```

Pass: Contains "MUTABLE" marker.

### Check 6: Export Config

```bash
ls export/defaults/vn-gov.yaml
ls export/filters/vn-gov-format.lua
ls export/export.ps1
```

Pass: All 3 exist.

### Check 7: Pandoc

```bash
pandoc --version | head -1
```

Pass: ≥ 3.0.

---

## Project-level Checks

### Check P1: Project Structure

```bash
ls projects/{slug}/_strategy_state.md
ls projects/{slug}/thinking-bundle/
ls projects/{slug}/content/
```

### Check P2: Thinking Bundle (post-FREEZE)

Required files after Checkpoint 3:
- `01-org-profile.md`
- `02-policy-landscape.md`
- `03-ecosystem-map.md`
- `04-gap-analysis.md`
- `05-strategic-framework.md`
- `06-initiative-portfolio.md`
- `07-dedup-report.md`
- `08-approved-outline.md`
- `09-section-deps.md`

All must have `frozen: true` or equivalent marker.

### Check P3: Dedup Complete

```bash
grep "dedup_status" projects/{slug}/thinking-bundle/07-dedup-report.md
```

Pass: `dedup_status: complete`.

### Check P4: Section Briefs

```bash
ls projects/{slug}/thinking-bundle/10-section-briefs/ | wc -l
```

Pass: ≥ 1 brief per CORE outline section.
