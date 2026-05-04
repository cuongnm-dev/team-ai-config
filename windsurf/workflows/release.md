---
description: Release workflow — verify CI, gather changelog, tag version, deploy. Pre-deployment checklist. Loads engineering-deploy-checklist skill. Anti-trigger - hotfix dùng /hotfix flow để đến reviewer trước.
---

# /release {version?}

Loads `engineering:deploy-checklist` skill (Cascade auto-load).

## Phase 1 — Pre-flight

| Check | Pass criteria |
|---|---|
| CI green | All checks passed on target branch |
| All required reviews approved | reviewer Approved per feature |
| Tests passing | unit + integration + E2E |
| No open critical issues | gh issues filtered |
| ADRs documented | new ADRs from this release recorded |
| Migration scripts ready | if DB changes |
| Feature flags configured | if flag-gated |
| Rollback plan documented | mandatory for risk ≥ 3 |
| Stakeholder sign-off | per project policy |

## Phase 2 — Generate changelog

Read `git log {prev-tag}..HEAD --pretty=format:%s | %an | %h`. Categorize:
- ✨ Features (commits with `feat:`)
- 🐛 Bug fixes (`fix:`)
- 🧪 Tests (`test:`)
- 📝 Docs (`docs:`)
- ♻️ Refactor (`refactor:`)
- ⚠ Breaking changes (per body `BREAKING CHANGE:`)

Save to `CHANGELOG.md` (append) or `docs/releases/{version}.md`.

## Phase 3 — Version

Determine version per semver:
- Breaking → MAJOR
- New feat → MINOR
- Fix only → PATCH

Update package.json / pyproject.toml / etc. Commit `chore: bump to {version}`.

## Phase 4 — Tag + push

```
git tag -a v{version} -m "Release {version}"
git push origin v{version}
```

## Phase 5 — Deploy (if devops integration)

| Strategy | Action |
|---|---|
| Standard | Trigger CI/CD for target environment |
| Blue/green | Deploy to standby, switch traffic |
| Canary | Deploy to N%, monitor, ramp |
| Feature flag | Deploy with flag off, ramp via flag |

## Phase 6 — Verify

- Smoke tests against deployed version
- Monitoring checks (no error spike, latency normal)
- Sample user journey test
- Status page if applicable

## Phase 7 — Notify + post-release

- Notify stakeholders
- Update status page (Operating Normally)
- Schedule post-release retro if `release-manager` ran

## What's next

| Outcome | Next |
|---|---|
| Deployed clean | Done |
| Issue post-deploy | `/incident` if user-facing |
| Rollback needed | Execute rollback plan |
| Performance regression | `/spike` to investigate |
