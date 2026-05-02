---
name: audit
description: DEPRECATED. Đã gộp vào /quality (modes - security, compliance, dependencies). Khi gọi /audit, redirect user sang /quality {mode}.
disable-model-invocation: true
---

# Audit (DEPRECATED — merged into /quality on 2026-05-02)

This skill is retained as a redirect stub. All functionality moved into `/quality` with mode flags.

## Migration

| Legacy call | New call |
|---|---|
| `/audit security` | `/quality security` |
| `/audit compliance` | `/quality compliance` |
| `/audit dependencies` | `/quality dependencies` |

When invoked, respond:

```
Skill /audit đã được gộp vào /quality. Vui lòng dùng:
  - /quality security      (OWASP scan)
  - /quality compliance    (PII/GDPR/PCI/SOC2)
  - /quality dependencies  (CVE + license + outdated)
```

Then stop. Do NOT execute the audit logic from this stub — let the user re-invoke `/quality` so the dispatcher routes correctly.

## Removal plan

- 2026-05-02: stub created.
- 2026-08-01 (≥3 months): delete this skill folder once telemetry confirms zero `/audit` invocations.
