---
name: quality
description: Review chất lượng code, sinh test, và kiểm toán dự án. 5 chế độ - review (xem PR/diff góp ý), gen-tests (sinh test unit/integration), security (quét lỗ hổng OWASP), compliance (PII/GDPR/PCI/SOC2), dependencies (CVE + license + outdated).
---

# Quality

Replaces: review-pr, gen-tests, security-scan, compliance-check, dependency-audit, audit (legacy).
Modes: `review` | `gen-tests` | `security` | `compliance` | `dependencies`.
User-facing output: Vietnamese. Artifact files + dispatch prompts: English.

## Mode detection

| Signal | Mode |
|---|---|
| PR URL, diff, "review this", "is this safe" | review |
| "generate tests", "add tests", "test coverage" | gen-tests |
| "security", "OWASP", "vulnerabilities", "pen test" | security |
| "compliance", "GDPR", "PCI", "HIPAA", "SOC2", "PII" | compliance |
| "dependencies", "outdated", "CVE", "license audit" | dependencies |

If user invoked the legacy `/audit` slash command — accept and route to one of {security, compliance, dependencies} based on the user's wording.

---

## Mode: review

Ad-hoc code review outside formal pipeline.

input: PR URL, branch name, file paths, or staged diff

steps:
1. Get diff: `gh pr diff` or `git diff`
2. Task(reviewer) → checklist:
   - Readability, naming, structure
   - Security (injection, auth bypass, data exposure)
   - Performance (N+1, unbounded queries, memory leaks)
   - Test coverage (new code has tests?)
   - Backward compatibility (breaking changes?)
3. Classify findings: must-fix / should-fix / nit

output:
```
## Review: {description}
verdict: {Approved | Changes requested | Blocked}

### Must-fix
- [{file}:{line}] {finding}

### Should-fix
- [{file}:{line}] {finding}
```

## Mode: gen-tests

QA identifies scenarios, dev writes test code following repo conventions.

input: module path, function name, or feature area

steps:
1. Scan existing test patterns (framework, naming, directory structure, helpers)
2. Task(qa) → test scenarios: happy path, edge cases, error cases, boundary values
3. Task(dev) → write test files matching repo conventions — MUST Read each target file before Edit/Write
4. Run tests → report results

output: test files in `{project-path}/src/` (or matching test directory)

## Mode: security

OWASP-based security audit for module or feature.

input: module path, feature area, or "full scan"

steps:
1. Task(security) → OWASP Top 10 scan:
   - Injection (SQL, command, XSS)
   - Auth/authz flaws
   - Sensitive data exposure
   - Security misconfiguration
   - Known vulnerable components
2. Classify: Critical / High / Medium / Low
3. For each finding: affected file, line, remediation

output: `{project-path}/docs/security/audit-{date}.md`

## Mode: compliance

Regulatory compliance check for PII/financial/regulated features.

input: feature-id or module + applicable regulations

steps:
1. Task(data-governance) → data handling:
   - PII inventory, storage locations, retention policy
   - Consent tracking, cross-border transfer
   - Data minimization assessment
2. Task(security) → access controls:
   - AuthN/AuthZ verification
   - Audit logging completeness
   - Encryption (rest + transit)

output: `{project-path}/docs/compliance/check-{date}.md`

## Mode: dependencies

Dependency health — outdated packages, CVEs, license issues.

steps:
1. Task(devops) → scan package manifests:
   - Outdated: major / minor / patch
   - CVEs: `npm audit`, `pip audit`, or equivalent
   - License: GPL/MIT/Apache/proprietary compatibility
   - Unused dependencies
2. Prioritize: Critical CVE > license violation > major outdated > minor

output: `{project-path}/docs/audits/dependency-{date}.md`

---

## What's next

| Outcome | Next |
|---|---|
| Review approved | Merge PR |
| Changes requested | Fix → re-run `/quality review` |
| Tests passing | `/quality review` for the test PR |
| Tests failing | Fix implementation, re-run |
| Critical security findings | `/code-change fix` per finding |
| Compliance gaps | Document remediation plan |
| Outdated deps | Update → `/quality gen-tests` for regression |
