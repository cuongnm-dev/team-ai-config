# Team AI Config

Shared Cursor + Claude Code configuration (agents, skills, rules, schemas) and `etc-platform` MCP server, distributed across the team via a single git repo + the **`ai-kit`** CLI.

## TL;DR for team members

```bash
# First-time install (one-liner)

# macOS / Linux:
curl -sL https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.sh | bash

# Windows (PowerShell):
irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex

# Open a NEW terminal, then:
ai-kit status      # check what's deployed
ai-kit update      # pull latest team config + restart MCP
```

That's it. Updates later: `ai-kit update`.

## What's inside

```
team-ai-config/
├── bootstrap.sh / bootstrap.ps1   ← team member: one-liner first install
├── publish.ps1                    ← maintainer: pack → commit → push (Windows)
├── bin/
│   ├── ai-kit                     ← POSIX CLI (linked to PATH)
│   ├── ai-kit.ps1                 ← Windows PowerShell CLI
│   └── ai-kit.cmd                 ← Windows cmd shim
├── claude/                        ← deployed to ~/.claude
├── cursor/                        ← deployed to ~/.cursor
└── mcp/etc-platform/
    ├── docker-compose.yml         ← runs etc-platform MCP server
    └── .env.example               ← (auto-copied to .env)
```

## ai-kit commands

```
ai-kit install     First-time setup (use bootstrap.* one-liner)
ai-kit update      Pull latest team config + redeploy + refresh MCP image
ai-kit status      Show versions, deployed counts, MCP health
ai-kit doctor      Verify deps + paths
ai-kit mcp <verb>  start | stop | restart | logs | pull | status
ai-kit version     Show ai-kit + team-config + MCP image versions
ai-kit uninstall   Remove ~/.ai-kit (keeps deployed config)
```

Aliases: `up` = update, `st` = status, `dr` = doctor.

## Prerequisites

| Tool | Why |
|---|---|
| **git** | Clone + pull team config |
| **docker** + Docker Desktop running | Run etc-platform MCP server |
| **rsync** (Mac/Linux only) | File sync |
| **bash 4+** (Mac/Linux) | ai-kit script |
| **PowerShell 5.1+** (Windows) | ai-kit script |

Mac comes with bash + rsync. Linux: `apt install rsync` or equivalent. Windows: PowerShell is pre-installed.

## What's preserved on every install/update

These files in `~/.claude` and `~/.cursor` are **never overwritten** (your private data):

| Pattern | Reason |
|---|---|
| `settings.local.json` | Per-user permission allowlist |
| `.credentials.json` | Personal Anthropic API key |
| `telemetry/` | Per-user usage telemetry |
| `cache/`, `file-history/`, `logs/`, `shell-snapshots/`, `todos/` | Runtime cache + history |
| `projects/`, `worktrees/`, `plans/`, `snapshots/`, `automations/`, `ai-tracking/` | Per-machine project state |
| `ide_state.json`, `argv.json`, `scheduled_tasks.lock` | IDE/runtime state |

If you want one of these to come from the team config instead, delete it from your local `~/` first, then `ai-kit update`.

## Backups

Every `ai-kit update` creates a timestamped backup:
```
~/ai-config-backup-YYYYMMDD-HHMMSS/
  .claude/
  .cursor/
```

Restore from backup:
```bash
rm -rf ~/.claude ~/.cursor
cp -R ~/ai-config-backup-<timestamp>/.claude ~/.claude
cp -R ~/ai-config-backup-<timestamp>/.cursor ~/.cursor
```

Clean up old backups when you're confident things work.

## After install — set your API key

The installer leaves these files alone (they're personal). Set them up:

```bash
# Mac / Linux:
cat > ~/.claude/.credentials.json <<EOF
{
  "claudeAiOauth": null,
  "anthropic_api_key": "sk-ant-..."
}
EOF

# Windows (PowerShell):
'{
  "claudeAiOauth": null,
  "anthropic_api_key": "sk-ant-..."
}' | Set-Content $env:USERPROFILE\.claude\.credentials.json
```

Restart Cursor + Claude Code.

## MCP server — etc-platform

Docker image: **[`o0mrblack0o/etc-platform:v3.0.0`](https://hub.docker.com/r/o0mrblack0o/etc-platform)** (public, no login needed).

Container runs on `localhost:8001`. Managed by `ai-kit mcp <verb>`:

```bash
ai-kit mcp status      # docker compose ps
ai-kit mcp logs        # docker compose logs -f etc-platform
ai-kit mcp restart     # restart container
ai-kit mcp pull        # pull latest image + recreate
ai-kit mcp stop        # stop + remove
ai-kit mcp start       # start
```

`ai-kit update` automatically runs `mcp pull + start`.

### Pinning a specific MCP version

Edit `~/.ai-kit/team-ai-config/mcp/etc-platform/.env`:
```
ETC_PLATFORM_IMAGE=o0mrblack0o/etc-platform:v3.0.0
```

Default is `:latest`. Pin to a version (e.g. `v3.0.0`) for stability.

## For maintainers — push a new release

When you've improved an agent / skill / rule:

```powershell
cd ~/team-ai-config
.\publish.ps1          # pack → validate → commit → push (prompts for message)
# hoặc:
.\publish.ps1 "fix: mô tả thay đổi"
```

`publish.ps1` tự động: pack từ `~/.claude` + `~/.cursor` → kiểm tra path máy cá nhân → commit → push.

Team members run `ai-kit update` to receive the change.

### Pushing a new MCP image version

When you've changed `D:/MCP Server/etc-platform/` source (separate repo):

```bash
cd "D:/MCP Server/etc-platform"
docker build -t o0mrblack0o/etc-platform:v3.1.0 .
docker push o0mrblack0o/etc-platform:v3.1.0
docker tag o0mrblack0o/etc-platform:v3.1.0 o0mrblack0o/etc-platform:latest
docker push o0mrblack0o/etc-platform:latest

# Update team-ai-config/mcp/etc-platform/.env.example to pin v3.1.0
# Commit + push team-ai-config
```

Team members get the new image on next `ai-kit update`.

## Customization that survives updates

If you want personal additions ON TOP of team config:
- **Cursor agents**: drop into `~/.cursor/agents/<your-prefix>-*.md`. `ai-kit update` won't delete files not present in the team repo (only deletes files that match team patterns and are excluded). Keep filenames distinct from team agents.
- **Claude rules**: append project-level rules to `<your-project>/CLAUDE.md` (per-project, not per-user) — these always win over global.

⚠ **Don't edit team agents directly** in `~/.claude/agents/foo.md`. Your edit will be overwritten on next `ai-kit update`. Either:
  - Open a PR to upstream your change, or
  - Make a copy with a different name (`my-foo.md`) and edit that.

## Troubleshooting

**`ai-kit: command not found`**
- New terminal needed (PATH). Or: `export PATH="$HOME/.ai-kit/bin:$PATH"` (Mac/Linux), Windows: open new PowerShell.

**`docker daemon not running`**
- Open Docker Desktop, wait for the whale icon to be steady, retry.

**Windows: "running scripts is disabled"**
- The shim `ai-kit.cmd` already passes `-ExecutionPolicy Bypass` — should work. If not: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

**MCP healthz fails**
- `ai-kit mcp logs` to see what's wrong
- Port 8001 already used: edit `~/.ai-kit/team-ai-config/mcp/etc-platform/.env` to set `ETC_PLATFORM_PORT=8002` (then update `~/.cursor/mcp.json` URL accordingly).

**`ai-kit doctor` shows missing PATH**
- Mac/Linux: re-source your shell rc (`source ~/.bashrc` / `source ~/.zshrc`)
- Windows: open a NEW terminal (PATH env var is set persistently but only loaded on new sessions)

**Want to roll back**
- See "Backups" section. Each `ai-kit update` saves a timestamped backup.

**Want to start over**
- `ai-kit uninstall` (removes `~/.ai-kit` only, keeps `~/.claude` and `~/.cursor`)
- Or full reset: `rm -rf ~/.ai-kit ~/.claude ~/.cursor` then re-run bootstrap

## Contributing

Before opening a PR:

- [ ] Agent/skill has `LIFECYCLE CONTRACT` block per `claude/schemas/intel/LIFECYCLE.md` §5
- [ ] Prompt body is English-only (Vietnamese only in `description` frontmatter or output examples — per CD-9)
- [ ] No machine-specific paths (`publish.ps1` cảnh báo nếu có)
- [ ] No secrets / API keys committed (.gitignore catches common patterns)
- [ ] If schema changed: bump version + add migration note in commit
