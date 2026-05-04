# Idea Graveyard — Loss-less Idea Register

Persistent record of every idea/feature/deliverable rejected during the brainstorm. Ensures zero idea-loss across spirals AND across sessions. Enables post-MVP backlog mining and prevents context-loss when user resumes after long gaps.

## File location

`{features-root}/_idea/idea-graveyard.md`

Created at first rejection event in any spiral. Append-only thereafter.

## Capture rules

Capture an idea to graveyard whenever:

| Trigger | Spiral | Action |
|---|---|---|
| User volunteers idea + immediately rejects mid-thought | Any | Capture before moving on |
| DEDUP verdict = REJECT | 2 | Auto-capture with verdict reason |
| User explicitly removes deliverable / story / feature mid-iteration | 2, 3, 4 | Capture with user-supplied reason |
| User demotes feature from must-have to dropped | 4 | Capture with demotion reason |
| Phase 4.5 reveals feature is too risky and user drops | 4.5 | Capture with risk reason |
| Coherence reconciliation menu path-c rejection | Any | Capture if option dropped |

NEVER discard silently. If skill detects idea-discard pattern (user says "bỏ", "thôi không cần", "scratch that") without explicit graveyard capture → flag warning + auto-capture.

## Entry format

Each entry is a markdown section with stable ID and required fields:

```markdown
## G-NNN — {idea/feature title}

- **Spiral:** {1 | 2 | 3 | 4 | 4.5 | 0.5 | 5}
- **Captured at:** {ISO timestamp}
- **Original idea / feature:** {1-2 sentence description as it was when proposed}
- **Reason for rejection:** {user-supplied or system-inferred reason}
- **Reason category:** {scope-creep | dedup-reject | dependency-unclear | roi-uncertain | risk-too-high | user-changed-mind | better-alternative | duplicate-of-G-XXX | other}
- **Linked decision (if any):** D-NNN (from `_pipeline-state.json#decisions[]`)
- **Linked DEDUP verdict (if any):** REJECT — {ecosystem_ref}
- **Resurrect-trigger:** {context shift that would make this relevant again — e.g. "post-MVP scope expansion", "if shared platform deprecated", "if dependency F-XXX completes"}
- **User-confidence in rejection:** {pct} % (asked at capture time: "Bạn confident bao % việc loại idea này là quyết định đúng?")
```

ID generation: G-001, G-002, ... sequential within graveyard file.

## Resurrect protocol

User can revive a graveyard entry via:

```
/from-idea --resurrect G-NNN
```

Or, during interactive session, skill detects resurrection signal:
- User mentions an idea name/keyword that matches a G-entry → skill prompts:

  *"Mình thấy `{idea title}` đã ở idea-graveyard (G-NNN, loại ngày {date}, lý do: {reason}). Bạn muốn resurrect ý tưởng này không? Giờ context có thay đổi gì khiến nó relevant lại?"*

User confirms YES → skill:
1. Read G-NNN entry from graveyard
2. Move entry to "Resurrected" section (mark with `~~strikethrough~~` original entry, add resurrection log)
3. Insert idea back into appropriate spiral output:
   - Spiral 2 deliverable → re-run DEDUP for fresh verdict
   - Spiral 4 story → re-evaluate priority + story-points
   - Phase 4.5 risk-driven drop → confirm risk profile changed
4. Append to `decisions[]`:

   ```json
   {
     "id": "D-resurrect-{ISO}",
     "topic": "resurrect",
     "value": "Resurrected G-NNN: {title}",
     "why": "{user-supplied context-shift reason}",
     "considered_alternatives": [],
     "confidence_pct": {pct},
     "assumptions": [{shift made this relevant}],
     "status": "active",
     "spiral": "{current}",
     "timestamp": "{ISO}"
   }
   ```

5. Mark idea-graveyard entry with resurrection note:

```markdown
## ~~G-NNN — {title}~~ (RESURRECTED)

(Original entry above — strikethrough)

### Resurrection log

- **Resurrected at:** {ISO}
- **Resurrected to spiral:** {N}
- **Context-shift reason:** {user explanation}
- **Linked new decision:** D-resurrect-{ISO}
```

Subsequent processing (spiral synthesis, Phase 5 crystallize) treats resurrected idea as a regular active candidate.

## Surfacing during recap (Phase 0.0)

When user resumes (`phases/resume.md`), if `idea_graveyard_count > 0`, append to recap:

```
💀 Idea graveyard: {N} ý tưởng đã loại trong session(s) trước.
   Xem: {features-root}/_idea/idea-graveyard.md
   Resurrect: /from-idea --resurrect <G-NNN>
```

If user spent significant time on graveyard ideas (≥ 3 entries with same `reason category`), surface insight:

```
💡 Pattern detected: {N} ideas rejected for "scope-creep". 
   Có thể bạn đang struggle với scope. Cân nhắc Re-do Phase 4 với MVP cut tighter?
```

## Graveyard-driven retrospective at Phase 6

Phase 6 handoff includes graveyard summary:

```
💀 Ideas not making it to MVP: {N}
   - {x} due to scope-creep
   - {y} due to DEDUP-reject (using shared platform instead)
   - {z} due to risk-too-high
   - {w} other

   These remain accessible for post-MVP iteration. See {features-root}/_idea/idea-graveyard.md.
```

This becomes input to backlog grooming after MVP launches.

## Anti-patterns

- Discarding ideas without writing to graveyard (silent loss is the cardinal sin of "voice recorder mode")
- Resurrecting without capturing context-shift reason (defeats the audit trail)
- Letting graveyard grow unbounded (> 50 entries → suggest archive subset to `idea-graveyard-archive-{date}.md`)
- Auto-resurrecting without user confirmation (always ASK)
- Capturing trivial wording changes as graveyard entries (graveyard is for substantive idea changes only — single-word rephrase doesn't qualify)

## Schema for tooling consumption

Other skills (resume-feature, generate-docs) MAY read graveyard but MUST NOT write. Read use cases:
- `resume-feature` post-MVP backlog grooming → list resurrect candidates
- `generate-docs` HDSD section "Future enhancements" → reference graveyard with rejection reasons

For machine-parsing, each entry's first line `## G-NNN — {title}` follows fixed regex `^## G-\d{3} — `.

## Edge cases

| Case | Handling |
|---|---|
| User wants to resurrect entry G-NNN that depends on another graveyard entry G-MMM | Detect dependency, ask user "Resurrect both?" — if yes, cascade resurrect |
| User resurrects entry whose original DEDUP verdict was REJECT | Re-run DEDUP — verdict may have changed (KB updates, platform deprecations); never blindly resurrect a REJECT |
| User wants to "permanently delete" graveyard entry | Refuse — graveyard is append-only audit trail. Suggest user mark as "no longer relevant" via comment instead |
| Two entries describe same idea (semantic duplicate in graveyard) | Skill detects semantic match (Levenshtein on titles + reason), prompts user to merge with comment "duplicate-of-G-XXX" |
