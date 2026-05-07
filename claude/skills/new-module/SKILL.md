---
name: new-module
description: Khởi tạo module SDLC mới (M-NNN) qua interview với Claude Opus 4.7. Skill auto-allocate ID + slug theo quy tắc canonical, không nhận tham số ID. Dedup-check hard-stop nếu trùng module có sẵn (suggest /update-module). Hand-off bằng cách suggest /resume-module sau khi user confirm. Trigger - thêm bounded context/domain mới; "tạo module mới"; mô tả nghiệp vụ chưa có domain phù hợp. Anti-trigger - module đã tồn tại in-progress thì /resume-module (Cursor); module có sẵn cần mở rộng thì /update-module (Cursor); thêm feature thì /new-feature. Example - "/new-module" (interactive, không tham số). Note - skill này dùng Opus cho interview/dedup/dependency-suggest chất lượng cao; pipeline drive vẫn ở Cursor side với /resume-module.
---

# New Module — Interview-first Entry Point (Claude Opus port)

User-facing prompts: Vietnamese. Skill prose + dispatcher prompts: English.

**Opus port rationale**: Interview, dedup decision (partial 0.60-0.85), and dependency NER are cognitive-heavy steps benefiting from Opus 4.7 capabilities. Pipeline driver `/resume-module` stays at Cursor side with qwen3.5-35b (task-oriented).

## ⚠️ ai-kit CLI Enforcement (ADR-005)

**MUST call `Bash("ai-kit sdlc scaffold module ...")` for atomic create — only after Step G confirm.** Skill = thin entry point.

| Step | ai-kit CLI command |
|---|---|
| Dedup check | `ai-kit sdlc dedup-check --kind module --query "..."` (graceful fallback to Agent(Explore) parallel) |
| Dependency suggest | `ai-kit sdlc deps-suggest --description "..."` (graceful fallback to Opus direct entity extraction) |
| ID allocation | `ai-kit sdlc allocate-id --kind module` (atomic; fallback to catalog max+1) |
| Atomic scaffold | `ai-kit sdlc scaffold module --id M-NNN --slug ... --depends-on ...` |
| Rollback | `ai-kit sdlc rollback --kind module --id M-NNN` (for Step I delete path) |

**Forbidden** per ADR-005 D3:
- ❌ Accept user-provided `module-id` argument (full auto per Q1=A)
- ❌ Accept user-provided `slug` argument
- ❌ Write `_state.md` / `module-brief.md` / `implementations.yaml` directly
- ❌ Direct edit of `module-catalog.json` / `module-map.yaml`
- ❌ Skip dedup check at Step 3 (HARD-STOP enforcement per Q3=A)

---

## ⚠️ SKILL ROLE — INTERVIEW + SCAFFOLD ONLY

This skill does NOT drive pipeline. It interviews user (Opus quality), validates uniqueness, scaffolds, then suggests `/resume-module {ID}`. PM dispatch is owned by `/resume-module` at Cursor side.

### Forbidden:
- ❌ Calling `Task(pm)` or `Task(specialist)` — pipeline driver is /resume-module (Cursor)
- ❌ Auto-spawning `/resume-module` via `Skill()` tool — Q2 confirmed: skill ends with suggestion, user invokes manually
- ❌ Reading agent definitions and "doing work yourself"

### Required:
- ✅ Steps 0-7 = setup (interview, dedup, dependency, scaffold)
- ✅ Step 7 (post-scaffold) ends with suggestion `/resume-module {ID}`
- ✅ User invokes /resume-module manually in next turn (likely at Cursor side)

---

## Step 0 — Argument handling (Q1=A: ignore user-provided ID)

If user invokes `/new-module M-007` or `/new-module {anything}`:

```
Print Vietnamese:
  "ℹ Tham số đã được bỏ qua — /new-module luôn auto-allocate ID + slug theo quy tắc canonical
   (tránh skip số thứ tự). Tiếp tục interview…"
```

Discard arg. Continue Step 1.

## Step 1 — Read intel + freshness gate (parallel reads with Agent)

Per LIFECYCLE.md P5 (stale-block). Opus port can use parallel reads:

```
Parallel reads via single message tool calls:
  Read docs/intel/_meta.json
  Read docs/intel/module-catalog.json
  Read docs/intel/feature-catalog.json
  Read docs/intel/actor-registry.json
  Read docs/intel/sitemap.json
  Read docs/intel/data-model.json
  Read docs/intel/id-aliases.json (if exists)

Stale check on _meta.artifacts[file].stale across {actor-registry, sitemap, module-catalog, feature-catalog, data-model}:
  IF any stale=true:
    STOP with message:
      "⚠ Intel artifact `{file}` is stale (last fresh: {produced_at}).
       Run /intel-refresh before /new-module to avoid propagating bad data.
       next-action: /intel-refresh --tier T1"
    EXIT
```

If `module-catalog.json` empty (zero modules) then INFO: "No existing modules — first module in workspace."

## Step 2 — Pre-flight interview (load shared notepad)

Load `~/.claude/skills/_shared/preflight-interview.md` and execute Step A (Description capture):
- 5 questions (problem, outcome, actors, scope, constraints)
- Validation rules (length, **Opus adaptive** vague-input guard, 3-retry cap)

**Opus advantage**: vague-input guard generates contextual follow-up questions instead of fixed retry prompt.

User abort then EXIT (no state mutation).

## Step 3 — Dedup check (HARD-STOP at strong match per Q3=A)

Execute Step B + C from shared notepad:

- B.1: Try `ai-kit sdlc dedup-check --kind module ...`
- B.2: Fallback to **Agent(Explore) parallel multi-pattern search** (Opus port advantage over Cursor `@Codebase`)
- C: Triage decision tree

Spawn 3 Explore agents in parallel for B.2:
- Catalog name+business_intent search
- Catalog flow_summary search
- Codebase route handler / page implementation search

Aggregate scores; HARD-STOP at >=0.85 with `next-action: /update-module {ID}` (run in Cursor — skill not available in Claude Code).

## Step 4 — Dependency suggest (Opus direct extraction)

Execute Step D from shared notepad:

- D.1: Try `ai-kit sdlc deps-suggest --description ...`
- D.2: **Opus direct entity extraction** (no regex heuristic — read description in-context, match data-model.entities semantically including VN ↔ EN aliasing)
- D.3: Display + user confirm/edit

Validate:
- Each suggested `depends_on` M-NNN exists in module-catalog -> if not, drop + warn
- DFS cycle check on proposed `depends_on` -> if cycle, STOP `MOD-CYCLE-001`

## Step 5 — Risk path estimation

Execute Step E from shared notepad. Heuristic same as Cursor (S/M/L based on scope + actors + integration + PII).

## Step 6 — Auto-allocate ID + slug

Execute Step F from shared notepad:

- F.1: Slug derivation (kebab-case, transliterate VN if no name_en)
- F.2: Atomic ID allocation `ai-kit sdlc allocate-id --kind module`

Read-only display (Q1=A locked).

## Step 7 — Confirm + scaffold + post-review

### 7a. Preview (Step G from shared notepad)

Display full SCAFFOLD PREVIEW block. User chooses [enter] / [b] back-edit (excl. locked ID+slug) / [a] abort.

### 7b. Atomic scaffold

CLI flag spec (canonical — `ai-kit sdlc scaffold module --help` for full details):

| Flag | Required | Constraint |
|---|---|---|
| `--workspace` | yes | absolute path |
| `--id` | yes | `^M-\d{3}$` (e.g. `M-007`) |
| `--name` | yes | min 3 chars; VN OK |
| `--slug` | yes | `^[a-z][a-z0-9]*(-[a-z0-9]+)*$` |
| `--depends-on` | no | csv of M-NNN; each must exist |
| `--primary-service` | no | `^[a-z][a-z0-9-]*$`; auto-populates `services[]`; NEVER M-NNN prefix |
| `--business-goal` | no | text >=50 chars rec. |
| `--risk-path` | no | `S\|M\|L` (default M) |
| `--output-mode` | no | `lean\|full` (default lean) |
| `--agent-flags` | no | JSON |
| `--expected-version` | no | int (optimistic lock) |
| `--stages` | no | `auto\|<csv>`; allowed names: `ba\|sa\|designer\|security\|tech-lead\|dev\|qa\|reviewer`; omit = lazy creation |

```
result = Bash("ai-kit sdlc scaffold module \
  --workspace . \
  --id {M-NNN} \
  --slug '{slug}' \
  --name '{name}' \
  --business-goal '{Q1+Q2 trimmed}' \
  --depends-on '{csv}' \
  --risk-path {S|M|L} \
  --primary-service '{primary_service or omit}' \
  --agent-flags '{json or omit}'")
```

CLI atomically writes `_state.md` + `module-brief.md` + `implementations.yaml`; updates `module-catalog.json` + `module-map.yaml` + `_meta.json`. Stage subdirs lazy by default (B-053 audit 2026-05-07).

On error: response includes `error.code`, `error.message` (with valid range inline), `error.details.flag` (which CLI flag), `error.details.expected_regex` or `details.allowed`, `error.fix_hint` (concrete guidance), `error.help_command` (recovery action). Read those first — do NOT spelunk into ai-kit source.

### 7c. Post-scaffold verify

```
Bash("ai-kit sdlc verify --workspace . --scopes structure,cross_references --strict warn")
```

MEDIUM/HIGH findings then display warnings, proceed.

### 7d. Post-scaffold review (Step I from shared notepad)

```
Print Vietnamese:
  "✅ Module M-NNN-{slug} đã được tạo

   Bạn còn bổ sung gì không?
     [enter]  Hoàn tất — gõ /resume-module M-NNN để bắt đầu pipeline
     [field]  Sửa: business_goal | depends_on | risk_path
     [d]      Delete (rollback)"
```

[d] rollback: confirmation "CONFIRM ROLLBACK" then `ai-kit sdlc rollback --kind module --id M-NNN`.

## Step 8 — Final guidance (Q2 confirmed)

When user picks `[enter]`:

```
Print Vietnamese:
  "✅ Module M-NNN-{slug} đã sẵn sàng.

   Để bắt đầu pipeline (ba -> sa -> … -> reviewer):
       /resume-module M-NNN

   Lưu ý: pipeline drive ở Cursor side (qwen3.5-35b — task-oriented).
   Nếu bạn đang chạy ở Claude Code, switch sang Cursor để gọi /resume-module.

   Module hiện ở stage `ba`, queue được set theo risk_path={S|M|L}.

   Để thêm features cho module này:
       /new-feature                 # interactive, parent module sẽ chọn từ catalog"

EXIT.
```

---

## Edge cases

| Condition | Action |
|---|---|
| `module-catalog.json` empty | INFO "first module in workspace", proceed |
| User provides arg | Step 0 ignore + warn |
| Intel stale | STOP `next-action: /intel-refresh` |
| User abort during interview | EXIT no state mutation |
| Strong dedup >= 0.85 | HARD-STOP `next-action: /update-module {ID}` (Cursor only) |
| Partial dedup + user picks 'u' | EXIT, suggest `/update-module {ID}` (Cursor only) |
| Partial dedup + user picks 'n' | Continue with `references: [{IDs}]` populated |
| `depends_on` cyclic | STOP `MOD-CYCLE-001` |
| `depends_on` references unknown M-NNN | Drop + warn at Step 4 |
| Slug derivation invalid | STOP — manual intervention |
| Slug collision | Auto-append `-2/-3...` |
| ai-kit CLI unavailable | Fallback Agent(Explore) parallel + warn |
| User picks `[d]` rollback at Step 7d | Confirmation phrase + atomic reverse |
| `--force-new` flag | Log to `_meta.json.dedup-overrides[]` + continue |
| MCP/CLI fails mid-scaffold | Atomic guarantee — surface error |

---

## What's next

| Outcome | Next |
|---|---|
| Module created, user satisfied | `/resume-module M-NNN` (likely at Cursor side) |
| Module created, user wants features | `/new-feature` (interactive) |
| Strong dedup HARD-STOP | `/update-module {existing-ID}` (Cursor only) |
| Rollback at post-scaffold | (no module — re-run if needed) |

Reference: `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8/D11 + `~/.claude/skills/_shared/preflight-interview.md` + Cursor mirror at `~/.cursor/skills/new-module/SKILL.md`.
