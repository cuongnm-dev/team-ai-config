# Prompt Cache Optimization — Skills, Agents, Rules

> Discipline guide to maximize cache hits across Anthropic prompt cache + Cursor Task() prefix cache. One byte mismatch in the prefix region = full miss + re-tokenization. This is the maintenance reference; not a substitute for live audit.

---

## 1. Cache mechanics — 3 invariants

| Invariant | Practical consequence |
|---|---|
| **Byte-identical prefix** | One char or one newline difference invalidates the entire cached prefix |
| **STATIC first, DYNAMIC last** | Any runtime value placed above static content terminates the cacheable region at that point |
| **TTL 5 min (Anthropic default)** | Idle gap > 5min → cold start. Continuous loop < 5min → warm |

---

## 2. Three-layer cache architecture in this pipeline

```
Layer 1 — Skill → Dispatcher
  ├─ FROZEN_HEADER (static, computed once at loop init)
  └─ DYNAMIC_SUFFIX (per-iter, billed)

Layer 2 — Dispatcher → Sub-agent (4-block template)
  ├─ ## Agent Brief         (static per stage+agent)
  ├─ ## Project Conventions (semi-static, project-level)
  ├─ ## Feature Context     (static within one feature lifecycle)
  └─ ## Inputs              (dynamic, per-call)

Layer 3 — Sub-agent system prompt (from .md frontmatter + body)
  └─ Fully static — never per-call interpolated
```

Each layer is independent. All three must follow STATIC-first discipline to benefit from cache.

---

## 3. ✅ Patterns currently applied (preserve)

| Pattern | Where | Why it works |
|---|---|---|
| FROZEN_HEADER + DYNAMIC_SUFFIX | `resume-feature/SKILL.md` § Step 6 | Computed once + identical bytes every iter |
| 4-block template | `dispatcher.md` § Task Prompt Template | Block ordering MANDATORY, explicitly documented |
| PM_FROZEN | `resume-feature/SKILL.md` § Step 7 PM escalation | PM dispatches share frozen prefix |
| Load-on-demand refs | `pm.md` → `ref-pm-*.md` | Refs loaded ONLY when trigger met (no system-prompt bloat) |
| Pointer-not-inline | `dev/fe-dev/ba/sa/qa/reviewer/security.md` → `ref-canonical-intel.md` | One-line pointer in agent.md (cache-safe), full content fetched at runtime |
| Static `.md` system prompts | All 28 cursor agents + 7 claude tdoc agents | No timestamps / run-ids polluting frontmatter |
| Append-only schema fields | `feature-catalog.schema.json` (enriched fields appended) | Existing fields keep their position |

---

## 4. ⛔ Anti-patterns — fix on sight

### 4.1 Inject runtime value into FROZEN_HEADER

```diff
  ## Pipeline Context
  feature-id: F-001
  docs-path: docs/features/F-001/
+ current-iteration: 5            ← ❌ DYNAMIC — breaks cache every iter
+ timestamp: 2026-04-25T10:30:00  ← ❌ Per-call — never hits cache
```

✅ Correct: dynamic fields belong in DYNAMIC_SUFFIX or Inputs block.

### 4.2 Reorder existing fields

```diff
  ## Pipeline Context
- pipeline-type: sdlc
- feature-id: F-001
+ feature-id: F-001         ← ❌ Reordering = byte mismatch from the very first field
+ pipeline-type: sdlc
  docs-path: ...
```

✅ Correct: new fields APPEND-ONLY at end of block. Field ordering immutable.

### 4.3 Whitespace drift

```diff
- prompt = FROZEN + "\n\n" + DYNAMIC
+ prompt = FROZEN + "\n\n\n" + DYNAMIC      ← ❌ Extra newline = different bytes
+ prompt = FROZEN + "\r\n\r\n" + DYNAMIC    ← ❌ Windows line endings
+ prompt = FROZEN + " \n\n" + DYNAMIC       ← ❌ Trailing space
```

✅ Correct: one canonical build pattern. `.rstrip("\n")` on both sides + `+ "\n\n" +`.

### 4.4 Visual changes (emoji, decorative dividers, ASCII art)

```diff
+ ╔════════════════╗      ← ❌ A few-byte encoding shift = byte mismatch
+ ║ FROZEN HEADER  ║
+ ╚════════════════╝
```

✅ Correct: ASCII art in system prompt is fine if STABLE. Don't add/remove decorative trim after cache is warm.

### 4.5 Inline timestamp / counter in agent system prompt

```diff
  ---
  name: dev
  description: ...
+ generated: 2026-04-25T10:00:00Z   ← ❌ Per-build
+ session: {session-id}             ← ❌ Per-invocation
  ---
```

✅ Correct: `.md` frontmatter contains STATIC metadata only (name, description, model, tools).

### 4.6 Inline values in dispatch prompt prefix (Stage 4)

```diff
- Agent(prompt="EXECUTE phases/s4b-write-tkkt.md. SLUG=customs. DOCS_PATH=docs/generated/customs/")
+ Agent(prompt="EXECUTE phases/s4b-write-tkkt.md. SLUG=<slug>. DOCS_PATH=<path>.")
```

→ Pattern 2 (current) is better: prefix `EXECUTE phases/s4b-write-tkkt.md.` stays stable; runtime values (`<slug>`, `<path>`) come at the end.

### 4.7 Loading all ref-* files into system prompt

```diff
# pm.md
  ---
  name: pm
  ---
  
+ {{include ref-pm-dispatch.md}}      ← ❌ Bloat system prompt 200+ lines
+ {{include ref-pm-templates.md}}     ← ❌ Loaded on every PM call even when not needed
```

✅ Correct: refs are LOAD-ON-DEMAND. PM Reads ref only when trigger is met (current pattern).

### 4.8 Vietnamese text in cache-prefix region (CD-9)

```diff
+ # Quy tắc làm việc                   ← ❌ VN takes 2-3x more tokens
+ Khi triển khai chức năng, đọc...     ← ❌ Tokenizer parses VN poorly
```

✅ Correct: agent/skill PROMPT BODIES in English. VN allowed only in:
- Frontmatter `description` field (user-facing, short)
- Output content examples (template field VALUES, not instructions)
- Schema `description` JSON fields (consumed by validators, not LLM prefix)
- User-facing CLI strings (printed back to user)

---

## 5. Hot-path optimizations

### 5.1 Tight loops (< 5min, > 10 iter)

| Action | Impact |
|---|---|
| Apply FROZEN/DYNAMIC discipline | -80% input tokens on iter 2+ |
| Avoid `sleep > 270s` between iter | TTL 5min — don't waste cache warmth |
| Reuse same subagent_type | Cache prefix per agent type |

### 5.2 Cross-feature pipeline (1 project, multiple features)

| Action | Impact |
|---|---|
| Project Conventions block static for the entire project | Cache hit across all features |
| Feature Context block changes per feature → cache hit only within one feature | Acceptable |
| Stage-specific blocks (dev-wave-N) → one cache entry per wave | Acceptable trade-off |

### 5.3 Cross-project (same machine, multiple repos)

| Action | Impact |
|---|---|
| Skill/agent .md in `~/.cursor/` is shared | Cache hit across all projects (until file changes) |
| Project-specific paths (`docs/intel/`, `docs-path`) cause miss | Expected — cross-project miss is natural |

### 5.4 Schema evolution (adding fields)

| Action | Impact |
|---|---|
| APPEND-ONLY new fields | Existing prefix stays intact → cache still hits |
| Inserting field in middle or reordering | Full cache miss — avoid absolutely |
| Bumping `schema_version` | One-time miss when all tools migrate; acceptable on major rev |

---

## 6. Pre-merge checklist

Before committing changes to skills/agents/rules, verify:

- [ ] No timestamp / run-id / session-id added to FROZEN region?
- [ ] No reordering of existing fields in FROZEN_HEADER or 4-block template?
- [ ] New fields appended at the end of block (not inserted mid-block)?
- [ ] Whitespace + newline count consistent?
- [ ] No ref-* file inlined into agent .md (pointer pattern preserved)?
- [ ] Static text byte-identical across invocations (verify with diff)?
- [ ] Dynamic data placed in DYNAMIC_SUFFIX or Inputs block, NOT above?
- [ ] Schema version bumped only on BREAKING change (else additive)?
- [ ] Body text in English (CD-9) — VN only in frontmatter description / output examples / schema description fields?

---

## 7. Cache-hit verification methods

### 7.1 Anthropic API direct (when calling via SDK)

```python
response = client.messages.create(
    model="claude-opus-4-7",
    system=[
        {"type": "text", "text": STATIC_SYSTEM, "cache_control": {"type": "ephemeral"}}
    ],
    messages=[{"role": "user", "content": prompt}]
)
print(response.usage.cache_read_input_tokens)      # > 0 = HIT
print(response.usage.cache_creation_input_tokens)  # > 0 = MISS (cache being created)
```

### 7.2 Inside Cursor Task() / Claude Agent()

Cursor + Claude Code don't expose cache metrics directly. Indirect signals:
- Iter 2+ latency drops > 50% vs iter 1 → cache likely hit
- Token usage report (per session) shows non-zero `cache_read_input_tokens`

### 7.3 Manual byte-diff test

When cache leak is suspected:

```bash
python build_prompt.py --iter 1 > /tmp/p1.txt
python build_prompt.py --iter 2 > /tmp/p2.txt

# DYNAMIC_SUFFIX must differ (that's the point); FROZEN_HEADER must match
diff <(head -c $FROZEN_LEN /tmp/p1.txt) <(head -c $FROZEN_LEN /tmp/p2.txt)
# Expected: no output (identical)
```

---

## 8. Token budget reference

| Stage | FROZEN | DYNAMIC | Net per iter |
|---|---|---|---|
| resume-feature dispatcher loop | ~150 tokens | ~30 tokens | ~30 (after iter 1) |
| dispatcher → sub-agent | ~80-200 tokens (4-block prefix) | ~50-200 tokens (Inputs) | depends on agent body |
| Sub-agent system prompt | 2K-5K tokens (.md body) | 0 | 0 (cached after first invocation per session) |
| Claude generate-docs Stage 4 dispatch | ~30 tokens (prompt) | ~10 tokens (vars) | parallel one-shot, cache N/A |

Rule of thumb: at loop ≥ 10 iter, FROZEN_HEADER saves ~80% input tokens on iters after iter 1.

---

## 9. References

- Anthropic prompt caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Cursor Task() prefix cache: implementation-dependent, best-effort
- Pipeline cache discipline: `~/.cursor/skills/resume-feature/SKILL.md` § 6 + `~/.cursor/agents/dispatcher.md` § Task Prompt Template
- Cross-skill artifact matrix: `~/.claude/schemas/intel/FILE_MATRIX.md`
- Intel layer rules (CD-10): `~/.claude/CLAUDE.md` § CD-10
- English-only rule (CD-9): `~/.claude/CLAUDE.md` § CD-9
