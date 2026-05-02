# Cursor 3 features + Custom Modes + Cursor Rules

Loaded on demand by `generate-docs/SKILL.md` for the feature/mode/rule reference tables.

---

## Cursor 3 first-class features used

| Feature | Stage | Purpose |
|---|---|---|
| **@Codebase semantic** | 1, 2 | Replace `grep` — Cursor index understands VN; better than text-search |
| **@Files / @Folders** | 1, 2, 4 | Smart loading — load only needed files, no eager dump |
| **@Docs** | 4 | Inline lookup docxtpl Jinja syntax, without leaving IDE |
| **@Web** | 4 | Inline lookup NĐ/QĐ legal references while writing TKCS |
| **@Notepads** | 4, 5 | 9 reusable refs (writing-style, NĐ 30, sitemap-schema, mermaid-templates...) — e.g., `@Notepads sitemap-schema` |
| **Composer diff review** | Gate 1, 2, 4, 5, 6 | MANDATORY — primary user approval mechanism |
| **MEMORIES.md** | Stage 0 + completion | Cross-session pipeline state, project-scoped |
| **Design Mode** (`Cmd+Shift+D`) | Stage 3b | Visual screenshot review WITHOUT vision tokens |
| **Custom Modes** | Stage 1, 2, 4 | 7 modes (Discovery / Code Researcher / Doc Harvester / TKKT / TKCS / TKCT / HDSD / xlsx Writer) — scoped system prompt + tool set |
| **Cursor Rules** (`.mdc`) | Stage 4, 5 | Auto-attach on edit content-data.json — inject NĐ/format/quality rules |
| **YOLO mode** | Stage 3, 6 | 200+ Playwright/MCP calls without interrupt |
| **Background Agent** | Stage 3 | Async capture while main chat continues Stage 4 research |
| **Checkpoints** | Pre-Stage 6 | Auto-rollback safety net on bad render |

---

## Cursor Custom Modes — what each does

| Mode | System prompt scope | Allowed tools | When to use |
|---|---|---|---|
| **Discovery Researcher** | Stage 1 — role-first scope discovery | @Codebase, @Folders, Composer | Stage 1 |
| **Doc Harvester** | Stage 2a — extract from BA docs | @Files docs/source/, @Codebase, @Notepads | Stage 2 Path A |
| **Code Researcher** | Stage 2b — extract from codebase | @Codebase, @Folders src/, @Notepads | Stage 2 Path B |
| **TKKT Writer** | Stage 4b — kiến trúc tổng thể | @Notepads hanh-chinh-vn, mermaid-templates; mcp__etc-platform__merge_content | Stage 4b |
| **TKCS Writer** | Stage 4c — cơ sở pháp lý + nghiệp vụ | @Notepads tkcs-legal-refs; @Web for legal | Stage 4c |
| **TKCT Writer** | Stage 4d — chi tiết kỹ thuật | @Notepads + @Codebase deep | Stage 4d |
| **HDSD Writer** | Stage 4e — UX manual end-user | @Files screenshots/, @Notepads sitemap-schema | Stage 4e |
| **xlsx Writer** | Stage 4f — test cases QA | @Notepads priority-mapping, edge-case-tc-templates | Stage 4f |

---

## Cursor Rules (.mdc) — auto-attach validators

Files in `cursor-rules/` are copied to `~/.cursor/rules/` and auto-attach when editing matching files:

| Rule file | Auto-attach when editing | Inject |
|---|---|---|
| `generate-docs-base.mdc` | `content-data.json` | Văn phong, fabrication policy |
| `generate-docs-tkkt.mdc` | architecture.* fields | TKKT validation |
| `generate-docs-tkcs.mdc` | tkcs.* fields | NĐ 30, legal refs |
| `generate-docs-tkct.mdc` | tkct.* fields | Module schema |
| `generate-docs-hdsd.mdc` | services[].features[] | HDSD UX rules |
| `generate-docs-xlsx.mdc` | test_cases.* | TC depth, role coverage |
| `generate-docs-diagrams.mdc` | diagrams.* | Mermaid templates |
| `generate-docs-placeholder-policy.mdc` | any field | `[CẦN BỔ SUNG]` rules |
| `generate-docs-prose-quality.mdc` | prose fields | Banned phrases, metrics |
| `generate-docs-cross-reference.mdc` | content-data + code-facts | Cross-validation |
| `generate-docs-deep-code-read.mdc` | tkct.modules[].columns | TKCT exception |
