# Pre-flight Interview Protocol

Loaded on demand by `/new-module`, `/new-feature`, `/update-module`, `/update-feature` to enforce interview-first workflow before scaffolding or mutating state.

User-facing prompts: Vietnamese. Internal logic + skill prose: English.

---

## Step A — Description capture (max 5 minutes)

Ask user the 5 questions below in a single block. Validate non-empty, retry up to 3x per question.

```
Vui lòng trả lời 5 câu sau (giúp hệ thống tránh trùng lặp + suy ra dependencies):

1. Vấn đề nghiệp vụ (problem) — 2-3 câu mô tả pain point hoặc gap
2. Kết quả mong đợi (outcome) — 1-2 câu kết quả đo được
3. Người dùng chính (actors) — list role (vd. hqdk, lanh-dao, taxpayer)
4. Phạm vi (scope) — chọn 1: [s] 1 màn hình | [m] đa luồng cùng module | [x] cross-system
5. Constraints — deadline / ngân sách / integration bắt buộc / "none"
```

**Validation rules**:
- Q1 >= 80 chars (else: "Mô tả quá ngắn — cần >= 80 ký tự")
- Q2 >= 30 chars
- Q3 >= 1 actor matching `actor-registry.roles[].slug` (else: warn, allow custom but log low confidence)
- Q4 enum
- Q5 free text or "none"

**Vague-input guard**: if Q1 is generic ("hệ thống cần tốt hơn", "fix bug", "improve performance") then ask follow-up:

```
⚠ Mô tả chưa đủ specific — phải chỉ rõ: ai bị ảnh hưởng, hành vi nào hỏng/thiếu, kết quả mong muốn.
   Ví dụ tốt: "Người nộp thuế đang phải nhập lại OTP khi session expire mid-form;
              cần auto-refresh OTP token nền background, không break UX."
   Vui lòng nhập lại Q1.
```

After 3 vague retries then STOP with `next-action: re-run với mô tả >=3 câu cụ thể`.

---

## Step B — Dedup search

Input: concatenated prose from Step A (Q1+Q2+Q3).

### B.1 Primary path — ai-kit CLI (when available)

```
result = Bash("ai-kit sdlc dedup-check \
  --workspace . \
  --kind {module|feature} \
  --query '<concatenated prose>' \
  --threshold 0.60")
parse stdout JSON for { ok, data: { candidates: [{ id, name, similarity, matched_fields, status }] } }
```

CLI implements: TF-IDF cosine on `business_intent + flow_summary + name`, optional embedding upgrade.

### B.2 Fallback path — when CLI unavailable

```
1. Token extract (drop VN/EN stopwords, lowercase): tokens = [...]
2. Read docs/intel/{module-catalog|feature-catalog}.json
3. For each entry:
   - Compute Jaccard similarity on (entry.name + entry.business_intent + entry.flow_summary) tokens
   - Score = jaccard * 0.6 + name_substring_match * 0.4
4. @Codebase "{Q1 first sentence}" then triage results: route handler / page implementing similar
5. Synthesize candidates list with similarity score (lossy heuristic; warn user "dedup degraded")
```

Surface: "⚠ ai-kit CLI unavailable — using heuristic dedup (lower precision). Run `ai-kit doctor` to diagnose."

---

## Step C — Triage decision tree (Q3=A confirmed)

```
candidates = sorted by similarity desc, top 5
max_score = candidates[0].similarity if candidates else 0

IF max_score >= 0.85:
  # HARD-STOP: strong duplicate
  Print Vietnamese:
    "⚠ Trùng {ID} (similarity {score}, status {status}).
     {match_rationale: shared tokens / fields}.
     -> Dùng `/update-{kind} {ID}` để update existing thay vì tạo mới.
     Nếu chắc chắn cần feature/module độc lập, phải re-run với --force-new
     (sẽ log audit trail trong _meta.json.dedup-overrides[])."
  next-action: /update-{kind} {ID}
  EXIT (no scaffold)

ELIF 0.60 <= max_score < 0.85:
  # PARTIAL: display, ask user
  Print Vietnamese:
    "Tìm thấy {N} ứng viên tương đồng (chưa đủ chắc trùng):
       1. {ID} — {name} (similarity {score}, status {status})
          matched: {fields}
       2. {ID} — ...
       3. {ID} — ...
     Lựa chọn:
       [u {ID}] Update existing — chuyển sang /update-{kind} {ID}
       [n] New anyway — tiếp tục scaffold, ghi `references: [{IDs}]` trong catalog
       [c {ID}] (feature only) Cross-cutting reuse — thêm parent_module vào {ID}.consumed_by_modules
       [a] Abort"

  IF user picks 'u' then EXIT, suggest /update-{kind}
  IF user picks 'n' then continue with references[] populated
  IF user picks 'c' (feature only) then atomic update existing.consumed_by_modules += [parent_module]; EXIT, suggest /resume-module {parent}
  IF user picks 'a' then EXIT

ELSE max_score < 0.60:
  # CLEAR: no dup, proceed
  Print Vietnamese: "✓ Không tìm thấy ứng viên trùng — tiếp tục tạo mới."
  Continue
```

**Audit trail**: when user picks `n` (new with references) at 0.60-0.85 partial match, write to `docs/intel/_meta.json.dedup-overrides[]`:

```json
{
  "kind": "feature|module",
  "new_id": "F-NNN | M-NNN",
  "matched_against": ["F-XXX:0.78", "F-YYY:0.65"],
  "decided_at": "<ISO>",
  "user_rationale": "<optional one-line>"
}
```

When user picks new anyway, ask one optional sentence "Tại sao không update existing?" then log if non-empty, không bắt buộc.

---

## Step D — Dependency suggest

### D.1 Primary — ai-kit CLI

```
result = Bash("ai-kit sdlc deps-suggest \
  --workspace . \
  --description '<Q1+Q2 concatenated>'")
parse stdout JSON for {
  data: {
    entities_detected: [{ entity, source: data-model|sitemap, confidence }],
    suggested_depends_on: [...],
    suggested_consumed_by: [...],
    suggested_role_visibility: { role-slug: full|partial|readonly|none }
  }
}
```

### D.2 Fallback — heuristic

```
1. Read docs/intel/data-model.json then entities[]
2. Read docs/intel/sitemap.json then modules[] + routes[]
3. Read docs/intel/actor-registry.json then roles[]
4. For each entity name in catalog:
   IF entity.name (lowercased, with stem variants) appears in description:
     entities_detected.append({entity, confidence: high if exact, medium if stem})
5. For each detected entity:
   - Find which modules own it (data-model.entities[].owner_module)
   - If owner_module != current_module then suggest depends_on
6. For each verb in description (CRUD: tạo|create|sửa|update|xóa|delete|xem|view):
   - Match permission patterns in permission-matrix.json
7. For each actor mentioned (Q3 from interview):
   - Match actor-registry then role_visibility default 'full' for primary, 'readonly' for secondary
```

### D.3 Display + confirm

```
Print Vietnamese:
  "Dependencies suy ra từ mô tả:
     depends_on: [M-001 (entity 'Taxpayer'), M-003 (entity 'TaxForm')]
     consumed_by_modules: [] (chỉ áp dụng cho cross-cutting feature)
     role_visibility:
       hqdk:        full
       lanh-dao:    readonly
       taxpayer:    none

   Chỉnh sửa? [enter] confirm | [d] edit depends_on | [c] edit consumed_by | [r] edit role_visibility"
```

Loop until user `[enter]`.

---

## Step E — Risk path estimation (modules) / Path Selection (features)

For modules — estimate risk_path S/M/L:

| Heuristic | risk_path |
|---|---|
| scope=1-screen + <=2 actors + no integration + no PII | **S** |
| scope=multi-flow + <=4 actors + <=1 integration + low PII | **M** |
| scope=cross-system OR >=5 actors OR >=2 integrations OR auth/PII/payment | **L** |

For features — defer Path S/M/L to PM Path Selection Logic post-BA (per pm.md). At interview time, just record `expected_pipeline_path: S|M|L` as a hint; PM may override.

Print Vietnamese:

```
Risk path đề xuất: {S|M|L}
  Lý do: {rationale}
  [enter] confirm | [s/m/l] override
```

---

## Step F — Slug + ID auto-allocation (full auto, no user override per Q1=A)

### F.1 Slug derivation

```
IF user provided 'name_en' OR Q1 prose contains English noun phrase:
  slug = kebab-case(name_en).lower()
ELSE:
  # Vietnamese only — transliterate
  slug = unidecode(name_vn).strip().lower()
  slug = re.sub(r'[^a-z0-9]+', '-', slug).strip('-')

# Validate
IF len(slug) > 40:
  slug = slug[:40].rsplit('-', 1)[0]   # truncate at word boundary
  Print Vietnamese: "⚠ Slug rút gọn '{slug}' (gốc dài {original_len} chars)."

IF NOT re.match(r'^[a-z][a-z0-9]*(-[a-z0-9]+)*$', slug):
  STOP with error "Slug derivation produced invalid result: '{slug}'"

# Collision check
existing_slugs = [m.slug for m in module-catalog.modules] OR [f.slug for f in feature-catalog.features]
IF slug in existing_slugs:
  base = slug
  for i in 2..99:
    candidate = f"{base}-{i}"
    if candidate NOT in existing_slugs:
      slug = candidate
      Print Vietnamese: "⚠ Slug '{base}' đã dùng — auto-append -> '{slug}'."
      break
  ELSE: STOP "Slug exhaust — manual intervention required"
```

### F.2 ID allocation (atomic)

```
result = Bash("ai-kit sdlc allocate-id --kind {module|feature}")
# Returns next M-NNN or F-NNN, locked atomically until scaffold completes

OR fallback:
read module-catalog.json AND id-aliases.json
all_ids = catalog.entries[].id ∪ id-aliases.reservations[]
max_num = max(int(id.split('-')[1]) for id in all_ids if id matches kind pattern)
new_id = f"{kind_prefix}-{max_num+1:03d}"
```

Print Vietnamese:

```
✓ ID allocated: {new_id}
✓ Slug: {slug}
```

Read-only display; user cannot edit per Q1=A.

---

## Step G — Confirm before scaffold

Display full preview block:

```
═══════════════════════════════════════════════════
  📦 SCAFFOLD PREVIEW — {new_id}
═══════════════════════════════════════════════════
  Kind:        {module | feature}
  ID:          {new_id}
  Name:        {name}
  Slug:        {slug}
  Path:        docs/{modules | modules/M-NNN/_features}/{new_id}-{slug}/

  Business goal: {Q1 trimmed to 200 chars}
  Scope:         {Q4}
  Actors:        {Q3 list}

  Dependencies:
    depends_on:  {list or '(none)'}
    consumed_by_modules: {list or '(none)'}    # feature only
    role_visibility:     {map or '(default)'}

  Risk path: {S|M|L}                             # module only
  Expected pipeline-path: {S|M|L hint}           # feature only

  References (from partial dedup): {list or '(none)'}
═══════════════════════════════════════════════════

Lựa chọn:
  [enter] Scaffold ngay
  [b]     Back — sửa lại field nào (sẽ vào edit mode)
  [a]     Abort — không scaffold
```

`[b]` allows editing any field except ID, slug, and parent_module (Q1=A locks those). After edit, return to preview.

---

## Step H — Atomic scaffold

Caller skill (new-module / new-feature) executes `ai-kit sdlc scaffold {kind} ...` with confirmed values. Skill prose handles success/error.

---

## Step I — Post-scaffold review (Q2 confirmed)

```
═══════════════════════════════════════════════════
  ✅ {ID} đã được tạo
═══════════════════════════════════════════════════
  Folder:       {path}
  Files:        {N} files updated atomically
  Catalog:      {module-catalog | feature-catalog}.json updated
  Sitemap:      placeholder added (status: planned, confidence: low)
  Permission:   placeholder added per role_visibility
  _meta.json:   versions bumped, sources_sha256 recorded

Bạn còn bổ sung gì không?
  [enter]    Hoàn tất — gõ `/resume-{module|feature} {ID}` để bắt đầu pipeline
  [field]    Sửa field cụ thể: business_goal | depends_on | consumed_by | role_visibility | risk_path
  [d]        Delete (rollback) — atomic reverse scaffold
```

**Edit field path**: skill prompts new value, calls `ai-kit sdlc state update --op field --path <field> --value '<json>'`, displays success.

**Delete path** (full atomic rollback):

```
ROLLBACK confirmation:
  Sẽ xoá folder {path} + revert {N} files (catalog, sitemap, permission, _meta).
  Type 'CONFIRM ROLLBACK' to proceed: ▌
```

If user types exact phrase then `ai-kit sdlc rollback --kind {kind} --id {ID}` then MCP/CLI atomic reverse. Else cancel.

**[enter] path**: print final guidance:

```
✅ Done. Để bắt đầu pipeline:

   /resume-{module|feature} {ID}

(skill này chỉ tạo + interview; pipeline drive bởi resume-* — đã có advisory lock + state machine.)
```

EXIT.

---

## Skill caller integration contract

Skills (new-module / new-feature / update-module / update-feature) load this notepad and call its steps in the order:

| Skill | Steps invoked | Where embedded |
|---|---|---|
| /new-module | A then B then C (HARD-STOP at strong) then D then E then F then G then H then I | Step 1-7 in SKILL.md |
| /new-feature | A then B then C then D then E (Path hint) then F then G then H then I | Step 1-7 in SKILL.md |
| /update-module | A (modified — change request only) then ripple then triage stage then reset then I | Step 3-7 in SKILL.md |
| /update-feature | A (modified) then ripple then triage then backup then I | Step 3-7 in SKILL.md |

Each skill is responsible for: (a) validating its own pre-conditions before A, (b) building the scaffold/update CLI call after G, (c) handling skill-specific edge cases listed in its own SKILL.md edge-case table.

This notepad is **stateless prose** — skill consumes prompts/logic, skill itself owns state transitions.
