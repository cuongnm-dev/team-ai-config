---
feature-id: {feature-id}
document: lean-architecture
output-mode: lean
last-updated: {YYYY-MM-DD}
verdict: {verdict}
---

# Architecture: {Feature Name}

## Summary
{2 sentences: approach chosen and key trade-off accepted}

## System Boundaries
| Service / Module | Responsibility | Owns | Calls | Exposes |
|---|---|---|---|---|

## Integration Model
| Integration | Type | Contract | Timeout | Retry | Idempotent |
|---|---|---|---|---|---|

## Data Architecture
| Entity | Owner | Storage | Consistency | Migration needed |
|---|---|---|---|---|

## Security
| Concern | Approach | Standard |
|---|---|---|
| Auth/authz | | |
| PII/secrets | | |
| Trust boundary | | |

## Deployment
| Concern | Approach |
|---|---|
| Env vars needed | |
| Migration | |
| Rollback plan | |
| Feature flag | |

## NFR Architecture
| NFR-ref | Solution | Target | Trade-off |
|---|---|---|---|

## Key Decisions
| Decision | Chosen | Rejected | Rationale |
|---|---|---|---|
