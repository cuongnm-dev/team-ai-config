# Pipeline Rules — Stage Gates, Verdicts, Traceability

> Loaded on-demand by `pm` and `dispatcher` when needed. Do NOT load eagerly into every chat.
> Source of truth for stage transitions, agent verdict taxonomy, and cross-agent ID traceability.

## Stage Gate Rules

| From | To | Gate Condition |
|---|---|---|
| PM intake | BA | Request classified, scope identified |
| BA | Designer | UI/UX impact flagged in spec (conditional — runs before SA) |
| BA / Designer | SA | BA + domain modeling complete, design findings present (if designer ran), zero critical ambiguities |
| SA | Tech Lead | Boundaries + data flow + contracts defined, blocking open questions = 0 |
| Designer | Tech Lead | Design findings + flow issues + suggested improvements present |
| Tech Lead | Dev | Task breakdown + execution sequence + QA guidance complete |
| Dev | DevOps | Tech Lead flagged Deployment/Runtime Impact (Path M/L only) |
| Dev | QA | Implementation summary + verification evidence present (Path M/L only) |
| Dev | Reviewer | Path S: implementation summary + verification evidence present (`inline_qa: true`) |
| DevOps | QA | Deployment ready or Deployment ready with risks |
| QA | Reviewer | Pass or Pass with risks verdict (Path M/L only) |
| Reviewer | PM | Final verdict (Approved / Approved with follow-ups / Changes requested / Blocked) |

## Extended Roles (Conditional — on-demand only)

Invoked by `pm` when trigger conditions are met. Max 2 per delivery item unless cross-domain risk justifies more.

| Agent | Trigger | Stage |
|---|---|---|
| `release-manager` | DB migration, complex rollback, multi-service deployment sequencing | After `dev`, before `reviewer` |
| `security` | Auth/authz boundary change, PII/payment/secrets impact | **Default (Path M):** alongside `reviewer` (code review only). **Add design review alongside `sa`** only on Path L (risk_score ≥ 4). |
| `sre-observability` | External integration resilience concerns, SLO-sensitive paths, high traffic/latency | Alongside `sa` + alongside `qa` |
| `data-governance` | Data ownership conflict, retention/deletion rules, compliance constraints | Alongside `ba` + alongside `sa` |

## Doc Generation Agents (separate pipeline)

These agents form a **parallel pipeline** for documentation artifact generation — distinct from the SDLC delivery pipeline above. They share the Dispatcher and `_state.md` schema but do **NOT** follow the A-F Pipeline Control Addendum (simpler verdict JSON).

| Agent | Phase | Input | Output |
|---|---|---|---|
| `doc-intel` | Description ingestion | Files in `docs/source/` (PDF/DOCX/images) | `intel/doc-brief.md`, `intel/tech-brief.md`, populated `_state.md` |
| `doc-researcher` | Code scan (4 phases: SCAN → ARCH → FLOW → FE) | `repo-path` | `intel/stack-report.json`, `arch-report.json`, `flow-report.json`, `frontend-report.json` |
| `doc-test-runner` | Playwright test generation + execution | `intel/frontend-report.json` | `playwright/scripts/*.spec.ts`, `intel/screenshot-map.json`, `screenshots/` |
| `doc-arch-writer` | Architecture doc writer | `intel/arch-report.json` | `output/architecture.md` |
| `doc-tkcs-writer` | Technical specification writer (VN format: Thiết kế cơ sở) | All intel reports | `output/tkcs.md` |
| `doc-testcase-writer` | Test case writer | `intel/flow-report.json` + test results | `output/test-cases.json` / `.md` |
| `doc-catalog-writer` | Catalog writer | Component/API catalogs | `output/catalog.md` |
| `doc-manual-writer` | User manual writer | `intel/flow-report.json` + screenshots | `output/huong-dan-su-dung.md` (per service if microservices) |
| `doc-exporter` | Office template filler (runs Python scripts, no LLM reasoning) | `output/*.json` + templates | `output/*.xlsx`, `output/*.docx` |

**Why no A-F addendum for doc-* agents:**
- Orchestration is owned by Dispatcher, not PM → no peer handoff summaries needed (D/E)
- Verdicts are binary (`ok` / `blocked`) not stage-gated → no Quantified Readiness Gate (B)
- No SLA per agent — whole pipeline measured end-to-end (no C)
- Simple JSON: `{status, verdict, output_files[], token_usage}` is sufficient

**Entry skills:** `/from-doc` (Claude Code only, vision model), `/generate-docs`, `/export-docs`. Routing table in `agents/dispatcher.md`.

## Verdict Taxonomy

| Agent | Valid Verdicts |
|---|---|
| `ba` | `Ready for solution architecture` / `Ready for Technical Lead planning` / `Need clarification` / `Blocked` |
| `sa` | `Ready for Technical Lead planning` / `Ready with known risks` / `Need clarification` / `Blocked` |
| `tech-lead` | `Ready for development` / `Ready with known risks` / `Need clarification` / `Blocked` |
| `dev` | `Ready for QA` / `Ready with known risks` / `Need clarification` / `Blocked` |
| `fe-dev` | `Ready for QA` / `Ready with known risks` / `Need clarification` / `Blocked` |
| `devops` | `Deployment ready` / `Deployment ready with risks` / `Need clarification` / `Blocked` |
| `qa` | `Pass` / `Pass with risks` / `Fail` / `Blocked` |
| `reviewer` | `Approved` / `Approved with follow-ups` / `Changes requested` / `Blocked` |
| `designer` | `Ready for handoff` / `Need clarification` / `Blocked` |
| `release-manager` | `Release ready` / `Release ready with risks` / `Need clarification` / `Blocked` |
| `security` | `Security approved` / `Security approved with findings` / `Changes required` / `Blocked` |
| `sre-observability` | `SRE ready` / `SRE ready with gaps` / `Need clarification` / `Blocked` |
| `data-governance` | `Governance approved` / `Governance approved with conditions` / `Changes required` / `Blocked` |
| `pm` | `Ready` / `Ready with known risks` / `Need clarification` / `Blocked` |

## Cross-Agent Traceability Convention

Every requirement ID produced by `ba` must flow unchanged through every downstream agent.
This is the team's primary mechanism for end-to-end accountability.

| ID Format | Produced By | Must Appear In |
|---|---|---|
| `US-001`, `US-002`... | `ba` | tech-lead (mapping), qa (coverage) |
| `AC-001`, `AC-002`... | `ba` | dev (Requirement Mapping table — every AC must have a status), qa (every test case references an AC), reviewer (explicit AC coverage check) |
| `BR-001`, `BR-002`... | `ba` | dev (business rules covered section), qa (rule-based test cases) |
| `BC-001`... | `ba` | sa (boundary mapping), tech-lead (module mapping) |
| `W{N}-T{N}` | `tech-lead` | dev (each task maps to one or more ACs), qa (test scope by wave) |
| `TC-001`... | `qa` | reviewer (test adequacy check references TC IDs) |
| `ADR-001`... | `sa` / `dev` | reviewer (architecture alignment check) |

### Traceability Rules (enforced by each agent)

- **dev**: Every row in the Requirement Mapping table must have an explicit `Status` — `Implemented`, `Partial`, or `Deferred (reason)`. No blank status.
- **qa**: Every test case must reference at least one AC ID in the test case row. "General regression" is not a valid AC reference.
- **reviewer**: Must explicitly verify AC coverage by ID in section 3 (Requirement Alignment). "All ACs covered" without listing them is not acceptable.
- **pm**: When routing `Changes requested` back to dev, must include the specific AC IDs affected by each must-fix item.

---

## Domain Authority — Conflict Resolution

When two agents produce conflicting outputs, the agent with **domain authority** over the contested area has the final say. This is resolved structurally, not by debate.

| Domain | Authority Agent | Overrides |
|---|---|---|
| Business requirements, scope, acceptance criteria | `ba` | All downstream agents |
| Security, auth/authz, PII, secrets | `security` | `sa`, `tech-lead`, `dev`, `reviewer` |
| Architecture boundaries, data contracts, NFR | `sa` | `tech-lead`, `dev` |
| Execution approach, wave structure | `tech-lead` | `dev` |
| Test coverage, quality verdict | `qa` | `dev` on defect classification |
| Compliance, data ownership | `data-governance` | `ba`, `sa` |
| Release safety, rollback readiness | `release-manager` | `devops`, `dev` |
| Final quality gate | `reviewer` | All agents |

If an agent believes the authority agent is wrong, it must explicitly flag it to `pm` with specific evidence — not silently ignore the authority or override it unilaterally. PM then decides whether to trigger a convergence session or escalate to PO.

<!-- Why this exists: Multi-agent surveys show that role-based authority hierarchies produce more
     consistent outcomes than rule-based coordination or open discussion. Conflicts resolved
     by authority are faster and more accountable than conflicts resolved by debate. -->

## Refinement Loop Limits

- Maximum **2 loops** per agent pair before escalating to Product Owner.
- Valid loops: `ba ↔ sa`, `ba ↔ designer`, `sa ↔ tech-lead`, `designer ↔ tech-lead`, `dev ↔ qa`, `dev ↔ reviewer`.

<!-- Why 2 loops maximum: Vague repeated iteration is one of the 14 documented failure modes
     of multi-agent systems (MASFT taxonomy, arXiv 2503.13657). After 2 loops, the root cause
     is usually a business ambiguity or architectural decision — neither agent can resolve it
     alone, so the correct action is escalation, not more iteration. -->

## Dev Wave Rules

- Max **8 dev agents per wave**.
- Each dev agent owns **non-overlapping files/modules** within a wave.
- Tasks touching shared contracts (API/schema/auth/migration) must be serialized.
- QA runs **after each wave** completes — not after all waves finish.

