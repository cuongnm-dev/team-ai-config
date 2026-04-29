---
title: ai-kit CLI — Reference
order: 20
---

# ai-kit CLI — 16 Commands Reference

```
Layout: ~/.ai-kit/
├── team-ai-config/   ← cloned repo
└── bin/ai-kit        ← symlink/cmd in PATH
```

## User commands

### `install`
First-time setup. Use `bootstrap.{sh,ps1}` instead — `install` chỉ tồn tại để symmetry.

### `update` | `up`
Pull team config mới + redeploy `~/.claude`/`~/.cursor` + refresh MCP image.

```bash
ai-kit update
ai-kit up         # alias
```

Internal flow:
1. `git pull --ff-only` team config
2. `deploy.sh|ps1` — sync claude/ + cursor/ vào `~/.claude` / `~/.cursor` (whitelist)
3. `docker compose down → pull → up -d` để áp image mới
4. Backup tự động ở `~/ai-config-backup-<timestamp>/`

### `status` | `st`
Show repo version, deployed counts, MCP container health.

```bash
ai-kit status
ai-kit st
```

### `logs`
Tail MCP container logs (= `ai-kit mcp logs`).

```bash
ai-kit logs       # Ctrl+C to exit
```

### `doctor` | `dr`
Verify deps + paths (`git`, `docker`, `python`, `curl`, `rsync` — Mac/Linux only, `bin/` in PATH).

```bash
ai-kit doctor
```

### `version` | `-v` | `--version`
Show ai-kit + team-config sha + MCP image tag.

```bash
ai-kit version
ai-kit -v
ai-kit --version
```

### `help` | `-h` | `--help` | `/?`
Show all commands.

## MCP control

### `mcp <verb>`

| Verb | Action |
|---|---|
| `start` | `docker compose up -d` |
| `stop` | `docker compose down` |
| `restart` | `docker compose restart` |
| `logs` | `docker compose logs -f etc-platform` |
| `pull` | `compose down → pull → up -d` (force new image) |
| `status` / `ps` | `docker compose ps` |

```bash
ai-kit mcp logs
ai-kit mcp pull
ai-kit mcp restart
```

## Backup management

### `list-backups` | `backups`
List backups dưới `~/ai-config-backup-*` theo thời gian giảm dần.

### `rollback [N]`
Restore từ backup #N (default 1 = newest). Confirm trước khi overwrite.

```bash
ai-kit list-backups
ai-kit rollback         # newest
ai-kit rollback 3       # backup #3
```

### `clean [--keep N]`
Xóa backup cũ (giữ N gần nhất, default 3) + `docker image prune`.

```bash
ai-kit clean
ai-kit clean --keep 5
```

## Maintainer

### `pack`
Snapshot `~/.claude` + `~/.cursor` (whitelist mode) → `repo/claude/` + `repo/cursor/`. Cảnh báo nếu phát hiện machine-specific paths.

```bash
ai-kit pack
```

Whitelist (chỉ những thư mục này được share):
- Claude: `agents/`, `skills/`, `schemas/`, `scripts/`, `CLAUDE.md`
- Cursor: `agents/`, `skills/`, `skills-cursor/`, `rules/`, `commands/`, `playbooks/`, `templates/`, `AGENTS.md`, `mcp.json`

### `publish "<msg>"`
Pack + `git add -A` + `git commit -m <msg>` + `git push`. One-shot release.

```bash
ai-kit publish "Refine ba prompt for AC validation"
```

### `diff`
Show file delta giữa deployed (`~/.claude`, `~/.cursor`) và repo. Hữu ích để xem ai sửa local trước khi publish.

```bash
ai-kit diff
```

Output:
- `+ (local-only)` — file có ở `~/`, không có trong repo
- `~ (modified)` — file khác content
- `- (in-repo)` — file có trong repo nhưng `~/` không có

### `edit`
Mở team-ai-config repo trong VS Code (nếu có), fallback `$EDITOR` → Explorer.

```bash
ai-kit edit
```

## Khác

### `uninstall`
Remove `~/.ai-kit` + stop MCP container. Giữ nguyên `~/.claude`, `~/.cursor`. Confirm trước.

```bash
ai-kit uninstall
```

## Environment variables

| Var | Mặc định | Tác dụng |
|---|---|---|
| `AI_KIT_HOME` | `$HOME/.ai-kit` | Override install dir |
| `CLAUDE_HOME` | `$HOME/.claude` | Override Claude config dir |
| `CURSOR_HOME` | `$HOME/.cursor` | Override Cursor config dir |
| `AI_KIT_FORCE_CLEAN` | unset | `=1` → bootstrap discard local repo edits |
| `AI_KIT_AUTO_INSTALL` | unset | `=1` → bootstrap auto-install missing tools |
| `REPO_URL` | `https://github.com/cuongnm-dev/team-ai-config.git` | Override repo URL |

## Exit codes

- `0` — success
- `1` — error (missing deps, invalid input, dirty repo, ...)
- Other — propagated from sub-process (docker, git)

## Liên quan

- [maintainer guide](../maintainer.md)
- [troubleshooting](../troubleshooting.md)
