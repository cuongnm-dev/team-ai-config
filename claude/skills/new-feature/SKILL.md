---
name: new-feature
description: Khởi tạo feature SDLC mới (F-NNN nested dưới M-NNN) qua interview với Claude Opus 4.7. Skill auto-allocate ID + slug theo quy tắc canonical, không nhận tham số ID. Bắt buộc chọn parent module từ catalog. Dedup-check hard-stop nếu trùng feature có sẵn (suggest /update-feature). Hand-off bằng cách suggest /resume-module sau khi user confirm (post-ADR-003 — pipeline drive ở cấp module). Trigger - thêm tính năng mới vào module có sẵn; "thêm feature"; mô tả nghiệp vụ chưa có feature phù hợp. Anti-trigger - feature đã tồn tại in-progress thì /resume-module (parent) hoặc /resume-feature (legacy); feature có sẵn cần update thì /update-feature (Cursor); chưa có module nào thì /new-module trước. Example - "/new-feature" (interactive, không tham số). Note - skill này dùng Opus cho interview/dedup chất lượng cao; pipeline + update-flow ở Cursor side.
---

# New Feature — Interview-first Entry Point (Claude Opus port)

User-facing prompts: Vietnamese. Skill prose + dispatcher prompts: English.

**Opus port rationale**: Interview, dedup decision, parent-module fit assessment, and cross-cutting `consumed_by_modules` suggestion benefit from Opus 4.7 cognitive depth. Pipeline driver `/resume-module` and update-flow stay at Cursor side.

## ⚠️ ai-kit CLI Enforcement (ADR-005)

| Step | ai-kit CLI command |
|---|---|
| Dedup check | `ai-kit sdlc dedup-check --kind feature --query "..."` (fallback Agent(Explore) parallel) |
| Dependency suggest | `ai-kit sdlc deps-suggest --description "..."` (fallback Opus direct extraction) |
| Parent module list | Read `docs/intel/module-catalog.json` |
| ID allocation | `ai-kit sdlc allocate-id --kind feature` |
| Atomic scaffold | `ai-kit sdlc scaffold feature --module M-NNN --id F-NNN --slug ... --consumed-by ...` |
| Rollback | `ai-kit sdlc rollback --kind feature --id F-NNN` |

**Forbidden** per ADR-005 D3:
- ❌ Accept user-provided `feature-id` or `slug` arguments (Q1=A)
- ❌ Write `_state.md` / `_feature.md` / `feature-brief.md` directly
- ❌ Direct edit of catalogs / maps / sitemap / permission-matrix
- ❌ Skip dedup check at Step 3 (HARD-STOP per Q3=A)
- ❌ Allow scaffold without parent module selection (FK)

---

## ⚠️ SKILL ROLE — INTERVIEW + SCAFFOLD ONLY

Skill interviews user, validates uniqueness, scaffolds, suggests `/resume-module {parent_M}`.

### Forbidden:
- ❌ Calling `Task(pm)` or `Task(specialist)`
- ❌ Auto-spawning `/resume-module` via `Skill()` tool (Q2)
- ❌ Reading agent definitions

### Required:
- ✅ Steps 0-7 = setup
- ✅ Step 8 ends with suggestion `/resume-module {parent_M}` (post-ADR-003) or `/resume-feature {ID}` (legacy)

---

## Step 0 — Argument handling

If user invokes `/new-feature {anything}`:

```
IF arg matches `^M-\d+$`:
  Print Vietnamese:
    "ℹ Bạn vừa nhập '{arg}' (module ID). /new-feature là để tạo feature, parent module sẽ chọn ở Step 1.5.
     Nếu muốn tạo module mới: /new-module
     Nếu muốn tiếp tục pipeline module: /resume-module {arg} (Cursor)
     Tiếp tục new-feature interview…"

ELSE:
  Print Vietnamese:
    "ℹ Tham số đã được bỏ qua — /new-feature luôn auto-allocate ID + slug.
     Tiếp tục interview…"
```

Discard arg. Continue Step 1.

## Step 1 — Read intel + freshness gate

```
Parallel reads:
  Read docs/intel/_meta.json
  Read docs/intel/module-catalog.json
  Read docs/intel/feature-catalog.json
  Read docs/intel/actor-registry.json
  Read docs/intel/sitemap.json
  Read docs/intel/data-model.json
  Read docs/intel/permission-matrix.json
  Read docs/intel/id-aliases.json (if exists)

Stale check on _meta.artifacts[file].stale -> STOP if any stale, next-action: /intel-refresh
```

## Step 1.5 — Parent module selection (FK gate)

If `module-catalog.json` empty:

```
Print Vietnamese:
  "⚠ Workspace chưa có module nào — feature phải nằm trong 1 module (post-ADR-003).
   Chạy /new-module trước, rồi quay lại /new-feature."
next-action: /new-module
EXIT
```

Else display modules with status filter:

```
Print Vietnamese:
  "Feature mới sẽ nest dưới module nào? (status ∈ {proposed, in-progress, blocked, done}):

     1. M-001-iam (Identity & Access — status: done, 12 features)
     2. M-002-taxpayer (Taxpayer Management — status: in-progress, 8 features)
     ...

   Nhập số thứ tự (1-N) hoặc M-NNN trực tiếp:"
```

Validation:
- Selected module exists
- status != deprecated (else: warn, ask continue/abort)
- status = done: warn "module đã sealed — feature mới sẽ trigger module re-open ở /resume-module" + ask continue

Cache `parent_module_id` for downstream.

## Step 2 — Pre-flight interview

Load `~/.claude/skills/_shared/preflight-interview.md` Step A.

Show parent module's `business_goal` before Q1:

```
Print Vietnamese:
  "Parent module: {parent_module_id} — {module_name}
   Business goal của module: {module.business_goal}

   Feature mới phải nằm trong scope module trên. Trả lời 5 câu sau:"
```

Opus adaptive vague-input guard.

## Step 3 — Dedup check (HARD-STOP at >=0.85)

Execute Step B + C from shared notepad with scope = entire feature-catalog (cross-cutting may match across modules).

B.2 fallback: Agent(Explore) parallel 3-agent search.

HARD-STOP behavior:

```
Print Vietnamese:
  "⚠ Trùng {ID} (similarity {score}, status {status}, owner module {owner_M}).
   {matched_business_intent excerpt}
   -> Dùng `/update-feature {ID}` (Cursor) để mở rộng feature hiện có.
   -> Nếu cần consume từ module khác:
      cân nhắc thêm `consumed_by_modules: [{parent_module}]` vào {ID} thay vì duplicate.
   -> Nếu chắc chắn cần độc lập, re-run với --force-new."
next-action: /update-feature {ID} (chạy trong Cursor — skill chưa có ở Claude Code)
EXIT
```

Partial match — extra option `[c]` cross-cutting reuse:

```
[c F-XXX]  Cross-cutting reuse — thêm parent_module vào F-XXX.consumed_by_modules thay vì tạo mới
```

`[c]` triggers atomic update:

```
Bash("ai-kit sdlc state update --op field --kind feature --id F-XXX \
  --path consumed_by_modules \
  --value '+= [\"{parent_module_id}\"]'")
```

Then EXIT, suggest `/resume-module {parent_module_id}`.

## Step 4 — Dependency suggest (Opus direct)

Execute Step D from shared notepad.

For features:
- `depends_on`: F-NNN list
- `consumed_by_modules`: cross-cutting M-NNN list
- `role_visibility`: role -> level map

Opus extracts entities directly from prose (VN ↔ EN aliasing).

Validate:
- depends_on F-NNN exist in catalog
- consumed_by_modules M-NNN exist in catalog
- parent_module_id NOT IN consumed_by_modules (auto-strip)
- role_visibility keys IN actor-registry.roles[].slug

## Step 5 — Pipeline-path hint

Heuristic S/M/L. Stored as `feature-catalog.features[].expected_pipeline_path`. PM in /resume-module re-evaluates post-BA.

## Step 6 — Auto-allocate ID + slug

Per Step F shared notepad. Display:

```
✓ ID allocated: F-{NNN}
✓ Slug: {slug}
✓ Path: docs/modules/{parent_module_id}-{parent_slug}/_features/F-{NNN}-{slug}/
```

LOCKED (Q1=A).

## Step 7 — Confirm + scaffold + post-review

### 7a. Preview

User chooses [enter] / [b] back (excl. locked: parent_module, ID, slug) / [a] abort.

### 7b. Atomic scaffold (CLI flags strictly per `ai-kit sdlc scaffold feature --help`)

CLI accepts ONLY these flags (verify via `ai-kit sdlc scaffold feature --help`): workspace, module, id, name, slug, description, business-intent, flow-summary, acceptance-criteria, consumed-by, priority, expected-version, stages. Fields `role_visibility` / `depends_on` / `expected_pipeline_path` / `references` are NOT scaffold inputs — populate post-scaffold via `state update`.

Note on `--stages` (audit 2026-05-07): default = no stage folders pre-created. Stage agents (dev, qa) mkdir their own folder when writing first artifact. Pass `--stages auto` if pipeline expects upfront `dev/` + `qa/` (legacy behavior); pass explicit csv like `--stages dev` to subset. Allowed values: `dev | qa`.

```
result = Bash("ai-kit sdlc scaffold feature \
  --workspace . \
  --module {parent_module_id} \
  --id {F-NNN} \
  --slug '{slug}' \
  --name '{feature_name}' \
  --business-intent '{Q1+Q2 trimmed, >=100 chars}' \
  --flow-summary '{Q1+Q4 derived, >=150 chars}' \
  --acceptance-criteria '{json array or "[]"}' \
  --consumed-by '{csv M-NNN list or empty}' \
  --priority {critical|high|medium|low}")
parse stdout JSON → if !ok: STOP with error
```

CLI atomically creates `_feature.md` (FeatureSpec per CD-23) + implementations.yaml + test-evidence.json + updates feature-catalog + sitemap (placeholder) + permission-matrix (placeholder) + feature-map + _meta.

### 7b.5. Post-scaffold field population (fields NOT supported by scaffold CLI)

Per CLI design, 4 fields collected during interview MUST be set via `state update --op field` after scaffold succeeds. Skip individual call when value empty/null.

```
IF role_visibility map non-empty:
  Bash("ai-kit sdlc state update --op field --kind feature --id {F-NNN} \
        --path role_visibility --value '{JSON.stringify(map)}'")

IF depends_on list non-empty:
  Bash("ai-kit sdlc state update --op field --kind feature --id {F-NNN} \
        --path depends_on --value '{JSON.stringify(list)}'")

IF expected_pipeline_path set (S|M|L):
  Bash("ai-kit sdlc state update --op field --kind feature --id {F-NNN} \
        --path expected_pipeline_path --value '\"{S|M|L}\"'")

IF references non-empty (from partial dedup [n]):
  Bash("ai-kit sdlc state update --op field --kind feature --id {F-NNN} \
        --path references --value '{JSON.stringify(list)}'")
```

On state update error → log warning but don't rollback scaffold (fields are enrichment). User can re-set via Step 7d `[field]` edit loop.

### 7c. Verify

```
Bash("ai-kit sdlc verify --workspace . --scopes structure,cross_references,id_uniqueness --strict warn")
```

### 7d. Post-scaffold review

```
Print Vietnamese:
  "✅ Feature F-NNN-{slug} đã được tạo

   Bạn còn bổ sung gì không?
     [enter]  Hoàn tất — suggestion ở Step 8
     [field]  Sửa: business_intent | depends_on | consumed_by | role_visibility | priority | expected_pipeline_path
     [d]      Rollback"
```

## Step 8 — Final guidance (Q2 + schema variant aware)

```
IF scaffold path = docs/modules/M-NNN-*/_features/F-NNN-*/:
  # Post-ADR-003 nested
  Print Vietnamese:
    "✅ Feature F-NNN-{slug} đã được tạo nested dưới {parent_module_id}.

     Per ADR-003: F-NNN nested không có pipeline riêng — pipeline drive ở cấp module.

     Để bắt đầu / tiếp tục pipeline:
         /resume-module {parent_module_id}

     Lưu ý: pipeline drive ở Cursor side. Nếu bạn đang ở Claude Code, switch sang Cursor.

     Stages-queue của module sẽ được PM re-evaluate khi thấy F-NNN mới."

ELSE (legacy):
  Print Vietnamese:
    "✅ Feature F-NNN-{slug} đã được tạo (legacy path).
     Để bắt đầu pipeline:
         /resume-feature F-NNN (Cursor)"
```

EXIT.

---

## Edge cases

| Condition | Action |
|---|---|
| `module-catalog.json` empty | Step 1.5 STOP `next-action: /new-module first` |
| User provides M-NNN arg | Step 0 special-case suggest /new-module or /resume-module |
| Parent module status=deprecated | Warn + ask continue/abort |
| Parent module status=done (sealed) | Warn re-open trigger + ask continue |
| Intel stale | STOP `next-action: /intel-refresh` |
| Strong dedup >= 0.85 | HARD-STOP `next-action: /update-feature {ID}` (Cursor) |
| Partial dedup + `[c]` cross-cutting | Update existing.consumed_by_modules atomically; EXIT, suggest /resume-module |
| Partial dedup + `[u]` | EXIT, suggest /update-feature (Cursor only) |
| Partial dedup + `[n]` | Continue with references[] |
| `depends_on` references unknown F-NNN | Drop + warn |
| `consumed_by_modules` references unknown M-NNN | Drop + warn |
| `parent_module_id` in `consumed_by_modules` | Auto-strip + INFO |
| `role_visibility` key not in actor-registry | Drop + warn |
| Slug collision | Auto-append `-2/-3...` |
| ai-kit CLI unavailable | Fallback Agent(Explore) + warn |
| User picks `[d]` rollback | Confirmation phrase + atomic reverse |
| `--force-new` flag | Log audit + continue |
| MCP/CLI fail mid-scaffold | Atomic — surface error |

---

## What's next

| Outcome | Next |
|---|---|
| Feature created in active module (post-ADR-003) | `/resume-module {parent_M}` (Cursor side) |
| Feature created in sealed module | `/resume-module {parent_M}` (will trigger re-open prompt) |
| Feature legacy path | `/resume-feature {F-NNN}` (Cursor) |
| Strong dedup HARD-STOP | `/update-feature {existing-ID}` (Cursor) |
| Cross-cutting reuse | `/resume-module {parent_M}` (consumed_by updated) |
| Rollback | (no feature — re-run if needed) |

Reference: `D:\AI-Platform\maintainer-notes\adr\ADR-003-sdlc-2tier-module-feature.md` D8 + `~/.claude/skills/_shared/preflight-interview.md` + Cursor mirror at `~/.cursor/skills/new-feature/SKILL.md` + CD-22 + CD-23 + CD-24 in `~/.claude/CLAUDE.md`.
