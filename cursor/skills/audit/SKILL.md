---
name: audit
description: Kiểm toán dự án về 3 mặt khác nhau, chọn 1 chế độ khi chạy: security (lỗ hổng bảo mật), compliance (tuân thủ tiêu chuẩn pháp lý/quy định), dependencies (các thư viện ngoài có an toàn không, có vulnerability nào không).
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

Input: module path, feature area, or "full scan"

Steps:
1. Task(security) → OWASP Top 10 scan:
   - Injection (SQL, command, XSS)
   - Auth/authz flaws
   - Sensitive data exposure
   - Security misconfiguration
   - Known vulnerable components
2. Classify: Critical / High / Medium / Low
3. For each finding: affected file, line, remediation

Output: `{project-path}/docs/security/audit-{date}.md`

## Mode: compliance

Regulatory compliance check for PII/financial/regulated features.

Input: feature-id or module + applicable regulations

Steps:
1. Task(data-governance) → data handling:
   - PII inventory, storage locations, retention policy
   - Consent tracking, cross-border transfer
   - Data minimization assessment
2. Task(security) → access controls:
   - AuthN/AuthZ verification
   - Audit logging completeness
   - Encryption (rest + transit)

Output: `{project-path}/docs/compliance/check-{date}.md`

## Mode: dependencies

Dependency health — outdated packages, CVEs, license issues.

Steps:
1. Task(devops) → scan package manifests:
   - Outdated: major / minor / patch
   - CVEs: `npm audit`, `pip audit`, or equivalent
   - License: GPL/MIT/Apache/proprietary compatibility
   - Unused dependencies
2. Prioritize: Critical CVE > license violation > major outdated > minor

Output: `{project-path}/docs/audits/dependency-{date}.md`

---

## What's next

| Outcome | Next |
|---|---|
| Critical security findings | `/code-change fix` per finding |
| Compliance gaps | Document remediation plan |
| Outdated deps | Update → `/quality gen-tests` for regression |
