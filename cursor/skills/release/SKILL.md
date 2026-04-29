---
name: release
description: Quản lý phát hành phiên bản. 4 chế độ: prepare (chuẩn bị release — check list, version bump), go-nogo (quyết định có release hay không dựa trên rủi ro), rollback (rollback nhanh nếu phiên bản mới bị lỗi), changelog (sinh ghi chú thay đổi cho khách hàng).
---

# Release

Replaces: release (old), go-nogo, rollback, changelog.
Modes: `prepare` | `go-nogo` | `rollback` | `changelog`.
User-facing output: Vietnamese.

## Mode detection

| Signal | Mode |
|---|---|
| "prepare release", "release package", "cut release" | prepare |
| "go/no-go", "ready to deploy?", "gate check", "pre-deploy" | go-nogo |
| "rollback", "revert", "roll back to" | rollback |
| "changelog", "release notes", "what changed" | changelog |

---

## Mode: prepare

Collect closed features, create release package.

Steps:
1. Read `docs/feature-map.yaml` → filter `status: done` since last release
2. Task(pm) → collect feature summaries from `_state.md` + retrospectives
3. Task(release-manager) → release checklist, migration plan, breaking changes
4. Task(devops) → verify deployment config, env vars, infra readiness

Output: `docs/releases/{version}/release-package.md`

## Mode: go-nogo

Pre-deploy gate check. Run RIGHT BEFORE deploy.

Automated checks (fail any → NO-GO):
- [ ] CI build green
- [ ] DB migrations tested (up + down)
- [ ] Environment variables complete
- [ ] Changelog present
- [ ] Smoke test list ready
- [ ] Rollback plan exists

Manual checks (report, user decides):
- [ ] Stakeholder sign-off
- [ ] Load test results reviewed
- [ ] Security scan clear

Output: `GO` or `NO-GO` verdict with failing items list

## Mode: rollback

Emergency rollback planning.

Steps:
1. Task(release-manager) → feasibility: migration reversibility, breaking changes, downstream
2. Task(devops) → step-by-step rollback runbook
3. Task(sre) → post-rollback monitoring + verification

Output: `docs/releases/{version}/rollback-plan.md`

## Mode: changelog

Generate changelog from closed pipelines in date range.

Steps:
1. Read `docs/feature-map.yaml` → filter `status: done` in range
2. For each: read `_state.md` → feature-name, verdict
3. Group: Features | Hotfixes | Breaking changes | Known issues

Output: `CHANGELOG.md` entry (keep-a-changelog format)

---

## What's next

| Outcome | Next |
|---|---|
| Release prepared | `/release go-nogo` |
| GO | Deploy |
| NO-GO | Fix items → re-check |
| Rollback planned | Execute runbook |
