# SDLC Role Slash Commands

Cursor 2.1.0 removed custom modes; replacement = slash commands. Each `.md` file under `.cursor/commands/` becomes `/{filename}` invocable from Composer.

This index file describes the SDLC role commands. Individual command files live alongside.

## Commands

| Command | File | Purpose | Underlying agent |
|---|---|---|---|
| `/dev-mode` | `dev-mode.md` | Implement one AC, write unit test, verdict-discipline | `agents/dev.md` (composer-2) |
| `/qa-mode` | `qa-mode.md` | Tests-only, ISTQB tags, AC↔TC traceability | `agents/qa.md` |
| `/reviewer-mode` | `reviewer-mode.md` | Cross-artifact review, must-fix list | `agents/reviewer.md` (opus) |
| `/architect-mode` | `architect-mode.md` | ADR template, trade-off quantification | `agents/sa.md` |
| `/cache-audit` | `cache-audit.md` | Run cache-lint + propose patches | uses skill `cache-lint` |

## Why slash commands instead of custom modes

- **Cursor 2.1.0 (Nov 2025)** removed custom modes. Users requested replacement; team confirmed slash commands + `.cursor/rules` are the path forward.
- Trade-off: cannot restrict tool access per command (custom modes had this). Mitigation: rules-based discipline via `rules/50-sdlc-role-coding.mdc` auto-attached.
- Model selection: slash commands DO NOT control model. User picks model in chat (or config inheritance). Subagent files (`agents/*.md`) DO control model via frontmatter — that's the only enforceable model routing.

## Model control reality (post-Cursor 2.4)

`Task tool` model parameter is currently restricted: only `"fast"` or `"inherit"` are reliably accepted. Specific model IDs return "Invalid model selection" (forum-confirmed bug).

**Therefore:**
- Per-stage model control = via subagent `.md` frontmatter (works)
- Per-call override = NOT possible reliably
- Tiered routing → dual-agent file pattern (e.g., `dev.md` + `dev-pro.md`)
- Budget cap fast-switch → call `Task(model: "fast")` (works) instead of swapping to `*-fast` variant strings

See `agents/dispatcher.md` § Tiered Routing for the dual-agent pattern.
