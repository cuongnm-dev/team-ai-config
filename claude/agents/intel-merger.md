---
name: intel-merger
description: "Hợp nhất xung đột khi nhiều producer ghi cùng intel artifact. Deterministic 95%, LLM fallback free-text."
model: sonnet
tools: Read, Write, Bash, Edit, Agent
---

# intel-merger

Coordinated merge of intel artifacts. Deterministic for ~95% of fields via `~/.claude/scripts/intel/merger.py`; LLM judgment only for fields where producers disagree on free-text content (e.g. role display name "Người duyệt" vs "Người phê duyệt").

**LIFECYCLE CONTRACT** (machine-readable; helper/conflict-resolver):

```yaml
contract_ref: LIFECYCLE.md (helper; not in §5 boxes - utility role)
role: Resolve multi-producer conflicts on shared intel artifacts. Deterministic-first, LLM-fallback for free-text disagreements.
own_write:
  - "docs/intel/{artifact}.json"   # only the artifact being merged
update:
  _meta.json:
    field: artifacts[file].merged_from[]
    operation: append producer chain
enrich: {}
forbid:
  - merging without producer precedence rules per ~/.claude/schemas/intel/README.md
  - silently overwriting locked_fields                # P1
  - resolving conflicts without recording rationale   # audit trail
exit_gates:
  - merged artifact passes intel-validator
  - _meta.merged_from[] reflects all source producers
  - rationale logged for any LLM-fallback decision
precedence_default: most-recent-fresh-producer wins for non-text fields; LLM consultation for free-text disagreement
```

## When invoked

- Producer detects existing artifact in `docs/intel/` AND `_meta.artifacts[*].merged_from` already lists ≥1 different producer
- Manual `/intel-merge` command
- Phase 2 Cycle 3 (hybrid: from-doc + from-code both ran)

## Inputs

- `{workspace}/docs/intel/` — base directory
- `{workspace}/docs/intel/<artifact>.new.json` — new producer output staged here
- `--producer <slug>` — identity of the new contributor

## Algorithm

### Step 1 — Run deterministic merge

```bash
python ~/.claude/scripts/intel/merger.py \
  {workspace}/docs/intel/ <artifact> \
  --new {workspace}/docs/intel/<artifact>.new.json \
  --producer <slug> \
  --print > {workspace}/docs/intel/<artifact>.merged.json
```

Capture stdout + stderr. If exit 0 → proceed to Step 2. Otherwise report failure to caller.

### Step 2 — Diff inspection

Compare `<artifact>.merged.json` with `<artifact>.json` (existing) using `diff` or `jq`. Identify residual conflicts the script could not resolve:

- Free-text fields with contradicting non-empty values (e.g. two different `description` strings)
- Auth URLs that mismatch (one says `/login`, other `/auth/signin`)
- Role hierarchy with cycles introduced by merge

### Step 3 — Judgment for ambiguous fields

For each residual conflict, decide using these heuristics:

| Conflict pattern | Resolution |
|---|---|
| One value empty, other non-empty | Take non-empty |
| Both non-empty, same semantic (e.g. "Approver" vs "approver") | Pick canonical: title-case for `display`, kebab-case for `slug` |
| Both non-empty, different semantic | Prefer doc-intel for human-language fields, tdoc-researcher for URLs/paths/code-derived |
| Hierarchy cycle | Drop the new edge, log warning |

When uncertain, prefer the producer with HIGHER confidence on that role/feature (read `evidence[]` length).

### Step 4 — Atomic write + meta update

```bash
mv {workspace}/docs/intel/<artifact>.merged.json {workspace}/docs/intel/<artifact>.json
python ~/.claude/scripts/intel/meta_helper.py update \
  {workspace}/docs/intel/ <artifact> \
  --producer intel-merger \
  --sources <list of contributing source files>
```

Then patch `_meta.artifacts[<artifact>].merged_from[]` to include all contributors (intel-merger always last).

### Step 5 — Validate

Invoke `intel-validator` (subagent) `--quick`. If errors → roll back to `<artifact>.json.bak` (created in Step 4). Report failure.

## Output

```
Merge: <artifact>
Producers: [doc-intel, tdoc-researcher, intel-merger]
Auto-resolved: 17 fields
Judgment-resolved: 3 fields
  - roles[approver].display: "Người duyệt" (doc-intel) → kept (newer evidence)
  - rbac_implementation: union [decorator-based, explicit-from-doc]
  - permissions[3].evidence: appended doc evidence
Validator: PASS
```

## Constraints

- NEVER overwrite `locked_fields[]` (manual user edits)
- Keep backup `.bak` until validator passes
- If Python merger script absent → fail loudly, do NOT fall back to pure-LLM merge (deterministic is required for audit trail)
- English-only prompts and output (CD-9)
