# MEMORIES.md format + Completion card + Resume map

Loaded on demand by `generate-docs/SKILL.md` after each stage and at completion.

---

## MEMORIES.md — full pipeline state (cross-session)

After each stage completes, append to `MEMORIES.md`. Cursor auto-loads next session → pre-fills + skips interview → saves ~5K tokens.

```markdown
## generate-docs

### {project-slug} (last-run: 2026-04-25)
- docs-path: docs/generated/{slug}/
- multi-role: true
- roles: ["admin", "manager", "staff"]
- service-ports: {api: 3000, web: 5173}
- auth-strategy: auto-login (per-role)
- capture-profile: desktop
- doc-route: AB hybrid (2026-04-25 score 3/5)
- last-output: docs/generated/{slug}/output/
- total-features: 30
- total-tc: 580
- cabosung-markers: 8
- runtime-min: 4.2
- stage-completion: [s0:✓, s1:✓, s2:✓, s3:✓, s4:✓, s5:✓, s6:✓]
- composer-gates-passed: [1, 2, 4, 5]
```

---

## Resume flow — artifact → stage detection

If interrupted → `/generate-docs` again — Cursor detects via artifacts:

| Artifact present | Stage completed |
|---|---|
| `intel/actor-registry.json` + `system-inventory.json` + `domain-skeleton.json` | Stage 1 |
| `intel/feature-catalog.json` + `sitemap.json` + `code-facts.json` | Stage 2 |
| `screenshots/*.png` ≥ N + `screenshot-validation.json` | Stage 3 |
| `output/content-data.json` (post-merge) | Stage 4 |
| `intel/quality-report.json` (passed) | Stage 5 |
| `output/*.docx` + `*.xlsx` | Stage 6 (done) |

User can `@Files intel/actor-registry.json` to load context and continue.

---

## Composer Checkpoints (Cursor 3 native)

Before Stage 6 export, create Checkpoint:

```
Cmd/Ctrl+Shift+P → "Cursor: Create Checkpoint"
name: "pre-export-{timestamp}"
```

If Stage 6 fails (residual `{{ }}`, abnormal file size) → `Cursor: Restore Checkpoint` rolls back `output/`.

NO manual LKG backup needed — Cursor handles it.

---

## Background Agent (Stage 3 long capture)

`hdsd` + ≥ 20 features → Stage 3 takes 5-10 minutes. Use Background Agent:

```
Cursor palette → "Cursor: Run in Background"
task: "Execute phases/s3a-capture.md for features F-001..F-030"
```

Main chat continues Stage 4 research while capture runs async. Notification when done.

---

## Completion card

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ DOCS GENERATED — {project-display-name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 {docs-path}/output/
     ├── kich-ban-kiem-thu.xlsx     ({N} TCs)
     ├── huong-dan-su-dung.docx     (~{N} pages, {M} role chapters)
     ├── thiet-ke-kien-truc.docx
     ├── thiet-ke-co-so.docx        ({N} [CẦN BỔ SUNG] markers)
     └── thiet-ke-chi-tiet.docx

  📊 Screenshots: {docs-path}/screenshots/  ({N} captured)
  🗺 Diagrams:    {docs-path}/output/diagrams/  ({N}/12+ rendered)
  🕒 Runtime:     {N} min
  💰 Tokens:      ~{N}K  (Path A saves ~65% vs code-scan)

  🎭 Multi-role:  {true/false}
  👥 Roles:       {list}
  🚪 Composer gates passed: {1, 2, 4, 5}

  ⚠ Human completion:
    [ ] Review [CẦN BỔ SUNG] markers → BA/PM fill
    [ ] Cmd+Shift+D check screenshots
    [ ] Ký 2 trang signing trong Word
    [ ] Open .docx → F9 refresh TOC

  💾 MEMORIES.md updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
