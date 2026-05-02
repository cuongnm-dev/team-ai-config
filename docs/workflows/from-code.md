---
title: Workflow — Codebase → Tài liệu Office
order: 12
---

# Workflow — Codebase → Tài liệu Office

Pipeline: **`/from-code` → (verify với `/from-doc`) → `/generate-docs`**.

## Khi nào dùng

- Codebase đã có sẵn (legacy / đã ship)
- Cần sinh tài liệu nghiệm thu / TKKT / TKCS / HDSD
- Có thể có hoặc không có SRS gốc

## Tiền điều kiện

- Codebase ở `D:/Projects/<your-project>/` (hoặc bất kỳ path)
- Docker đang chạy
- `ai-kit status` báo OK

## Quy trình

### 1. Reverse engineering (Claude Code)

```
/from-code D:/Projects/be-portal
```

Phases:
1. **Preflight** — detect framework (Angular/.NET/etc.)
2. **Static harvest** — parse routes, entities, RBAC decorators
3. **Actor enum** — extract roles từ auth code
4. **Feature synthesis** — group endpoints + UI components → features
5. **Architecture** — sequence diagrams, ER, integrations
6. **Scaffold** — `_state.md` per feature

Output:
- `docs/intel/{system-inventory,actor-registry,permission-matrix,feature-catalog,sitemap,data-model}.json`
- `docs/intel/code-brief.md`
- `docs/intel/arch-brief.md`
- `docs/features/F-NNN/_state.md` với `source-type: code-reverse-engineered`
- `feature.status: implemented` (vì code đã có)

### 2. (Optional) Verify với SRS — `/from-doc`

Nếu có SRS gốc, chạy `/from-doc` SAU `/from-code` ở verify mode:

```
/from-doc <srs.docx>
```

Skill detect intel đã có → chuyển verify mode:
- Match SRS features ↔ code features (qua business intent embedding)
- Output `docs/intel/drift-report.json`:
  - `matches` — đã verify đúng
  - `unmatched_in_baseline` — code có nhưng SRS không nói (feature creep?)
  - `unmatched_in_verifier` — SRS yêu cầu nhưng code chưa có (gap)

### 3. Fill thông tin còn thiếu

Một số fields chỉ con người biết (T3 doc-only — NFR, ATTT, dự toán):

```
/intel-fill
```

Wizard hỏi theo dependency order:
- ATTT level (1-5)
- DPIA done?
- NFR targets (response time, RPO/RTO)
- Cost estimates

### 4. Sinh Office files

```
/generate-docs
```

Khác với from-doc workflow — vì features đã `implemented`:
- Stage 3a (capture) skip features có sẵn screenshots
- Stage 4f (xlsx) reuse existing test-evidence (assembly mode, không synthesize)

## Healthy vs Legacy projects

| Tình trạng | Handler |
|---|---|
| **Healthy** — đã chạy `resume-feature` QA (atomic triple: TC + Playwright + screenshots) | `/generate-docs` ASSEMBLY-only — chỉ gom artifacts |
| **Legacy** — không có test-evidence | `/generate-docs` rich fallback — synthesize TC qua ISTQB + VN gov dimensions, đánh dấu `proposed` |

CD-10 Quy tắc 17-18.

## Ví dụ thực tế

```bash
# 1. Reverse-engineer
User: /from-code D:/Projects/be-portal
> Detected: Angular 18 + .NET 9 + PostgreSQL
> Found: 12 modules, 47 features, 8 roles
> Generated: F-001..F-047

# 2. Verify với SRS (nếu có)
User: /from-doc D:/Projects/be-portal/docs/source/SRS-v0.3.docx
> Mode: verify (intel layer detected)
> Matches: 35 features (high confidence)
> Drift: 8 features in code missing in SRS (suspect feature-creep)
> Gap: 4 features in SRS missing in code (planned)
> Output: docs/intel/drift-report.json

# 3. Fill T3
User: /intel-fill
> ATTT level: 3
> DPIA done: yes
> ...

# 4. Generate
User: /generate-docs
> Stage 4f: 580 TCs assembled (passed: 580/580)
> Output: docs/generated/be-portal/output/
```

## Liên quan

- from-doc — Greenfield (chưa có code)
- new-feature — Thêm feature mới sau reverse-engineering
- troubleshooting
