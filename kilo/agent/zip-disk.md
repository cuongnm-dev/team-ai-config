---
description: Customer delivery package. Zip toàn bộ docs + source + test artifacts theo customer requirements. Output - 1 .zip file ready để giao khách. Bao gồm verification report.
mode: primary
model: anthropic/claude-sonnet-4-20250514
---

# /zip-disk {customer?}

Customer delivery packaging. Bundle docs + source + evidence for handoff.

## Step 1 — Detect repo + customer

Run `notepads/repo-detect` equivalent — extract:
- `REPO_SLUG` (from git remote or package.json name)
- `ZIP_NAME` (default: `{repo-slug}-{date}.zip`)

Ask user customer name if not in default config.

## Step 2 — Confirm scope

```
## Delivery Package

**Repo:** {REPO_SLUG}
**Customer:** {customer}
**Output:** {ZIP_NAME}
**Will include:**
- docs/ (all generated docs + intel + ADRs)
- src/ (source code)
- tests/ (test suites)
- test-evidence (Playwright + screenshots)
- README + LICENSE
- Verification report

**Will exclude:**
- node_modules, .venv, target (build artifacts)
- .env, .env.local (secrets)
- .git (history not for customer)
- internal docs (docs/internal/, maintainer-notes/)

Continue? (y/n)
```

## Step 3 — Build manifest

List files to include. Save to `.cursor/tmp/zip-manifest.txt` for review.

## Step 4 — Run zip script

```
python ~/.ai-kit/scripts/zip-disk/zip_disk.py \
  --docs-out {repo}/docs \
  --src-dir {repo}/src \
  --zip-path {ZIP_NAME} \
  --include-pdf  (optional)
```

## Step 5 — Verify

Run `notepads/verify-report` equivalent:

| Check | Pass criteria |
|---|---|
| Integrity | unzip + sha256 stable |
| Summary | Counts match manifest |
| Optional checksum | sha256 file generated |
| Optional extract test | Test extraction in temp dir works |
| Optional drive write | Write to USB drive works |
| VN README | README.vn.md present + valid |

Output `verification-report.md` alongside zip.

## Step 6 — Output

```
✅ Delivery package ready
📦 {ZIP_NAME}
📊 Verification: PASS / WARN / FAIL
📍 Location: {path}

Next: deliver to customer per protocol.
```

## What's next

| Result | Next |
|---|---|
| All pass | Deliver to customer |
| Warnings | User decides accept/fix |
| Fail | Fix issues, re-run |
