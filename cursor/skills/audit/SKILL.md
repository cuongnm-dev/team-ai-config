---
name: audit
description: Kiểm toán dự án về 3 mặt khác nhau, chọn 1 chế độ khi chạy: security (lỗ hổng bảo mật), compliance (tuân thủ tiêu chuẩn pháp lý/quy định), dependencies (các thư viện ngoài có an toàn không, có vulnerability nào không).
disable-model-invocation: true
---

# Audit

Replaces: security-scan, compliance-check, dependency-audit.
Modes: `security` | `compliance` | `dependencies`.
User-facing output: Vietnamese.

## Mode detection

| Signal | Mode |
|---|---|
| "security", "OWASP", "vulnerabilities", "pen test" | security |
| "compliance", "GDPR", "PCI", "HIPAA", "SOC2", "PII" | compliance |
| "dependencies", "outdated", "CVE", "license audit" | dependencies |

---

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
| Critical security findings | `/code-change fix` per finding |
| Compliance gaps | Document remediation plan |
| Outdated deps | Update → `/quality gen-tests` for regression |
