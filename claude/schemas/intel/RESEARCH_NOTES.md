# Research Notes — Document Automation Patterns

**Session**: 2026-04-28
**Purpose**: Evidence-backed survey of industry patterns trước khi finalize WORKFLOW_DESIGN.md
**Method**: 15 web searches + 7 in-depth fetches across 8 pattern clusters

---

## 1. Diátaxis Framework (Daniele Procida, Canonical, Ubuntu)

### Core finding

4 documentation types với 2 trục phân loại:

| | Action (doing) | Cognition (knowing) |
|---|---|---|
| **Study (learning)** | Tutorial | Explanation |
| **Work (task)** | How-to | Reference |

**Anti-pattern chính**: blurring boundaries. "Crossing or blurring the boundaries described in the map is at the heart of a vast number of problems in documentation."

### Mapping vào 5 target docs của ta

| Doc | Type Diátaxis | Audience | Implication cho writer |
|---|---|---|---|
| TKKT | **Reference** + ít Explanation | Lãnh đạo + KTS trưởng | Facts about architecture; rationale only when needed for design decisions |
| TKCS | **Reference** + nhiều Explanation | Bộ TC / Sở TC (non-tech approver) | Technical facts dịch sang investment language; explain WHY (rationale, alternatives) |
| TKCT | **Reference** thuần | Engineer + QA | Pure facts: schema, API, modules; no narrative needed |
| HDSD | **Tutorial** + **How-to** | End users theo role | Learning by doing (Tutorial cho new user); task-oriented (How-to cho daily task) |
| xlsx test-cases | **Reference** | QA team | Catalog of test cases, không kể chuyện |

→ **Insight**: 5 docs có 4 different audiences và 4 different writing styles. Cố ép một template chung là anti-pattern.

### Sequin migration lessons (Sequin Stream blog)

- Migration iterative, không big-bang: tutorials trước → how-tos → references → explanations
- "If a guide felt awkward to write, it's probably highlighting a product issue" → if extracting feels awkward, source has issue
- Phantom links: trong how-to, link tới reference page CHƯA viết → identifies gaps
- Tool: loaded Claude project với Diátaxis resources để get feedback on draft

### Sources
- [diataxis.fr](https://diataxis.fr/) — official framework
- [diataxis.fr/start-here/](https://diataxis.fr/start-here/) — 5-min intro
- [Sequin Stream blog](https://blog.sequinstream.com/we-fixed-our-documentation-with-the-diataxis-framework/) — practical migration
- [Canonical/Ubuntu adoption](https://ubuntu.com/blog/diataxis-a-new-foundation-for-canonical-documentation)

---

## 2. Docassemble — Interview-Driven Document Automation

### Core architecture

Docassemble (open-source, Python + YAML + Markdown) là pattern gần nhất với case ta:

**Key principle**: "Interview developers do NOT design the flow. Docassemble automatically determines what questions to ask, and the order, based on what information is necessary to gather."

→ User declares **what fields exist**. System derives **when to ask**.

### YAML block types (từ search results khác)

- **Mandatory blocks**: outputs that MUST be produced (the goals)
- **Code blocks**: dependency expressions (this field needs that field)
- **Question blocks**: prompts to user
- **Template blocks**: document outputs

→ Engine builds dependency DAG: từ mandatory output back-traverse → tìm fields chưa có → ask. **Skip unnecessary questions** automatically (e.g. "if user is not disabled, don't ask age-related disability questions").

### Implication cho `/intel-fill`

**Right pattern**:
```yaml
mandatory: ["business-context", "tier3-complete"]

# Field declarations
business-context.legal_basis: { min: 3, type: legal-ref-list }
business-context.objectives.specific: { min: 3, type: objective-list }
nfr-catalog.items: { min: 7, type: nfr-list }
security-design.attt_level: { type: enum[1,2,3,4,5] }
security-design.attt_rationale: { type: text, depends_on: attt_level }
infrastructure.hardware: { type: list, depends_on: deployment_model.type=on-premise }
...

# System auto-determines:
# 1. attt_level asked first (no deps)
# 2. attt_rationale asked after attt_level
# 3. infrastructure.hardware ONLY asked if deployment is on-premise
# 4. Skip business-context.objectives if already filled
```

**Wrong pattern** (chộp giật):
```
Linear question list 1, 2, 3... not respecting dependency.
User must answer all even if some inferable.
```

### Sources
- [docassemble.org](https://docassemble.org/) — landing
- [LexRatio article](https://lexratio.eu/2024/10/08/docassemble-legal-document-automation/) — overview
- [Suffolk LIT Lab Legal Tech Class intro](https://projects.suffolklitlab.org/legal-tech-class/docs/introduction-to-docassemble/)

---

## 3. LangGraph + Pydantic AI — Modern Agent Workflow

### Core architecture (LangGraph 1.0, Oct 2025)

Workflow = directed graph với 3 components:
- **State** — shared data structure (TypedDict or Pydantic BaseModel)
- **Nodes** — functions that read state, do work, return updates
- **Edges** — functions that determine next node based on state

"Nodes do the work, edges tell what to do next."

### Self-correcting validation pattern

```python
def validate_output(state: State) -> Literal["fix_node", "success_node"]:
    if not is_valid(state["result"]):
        return "fix_node"  # loop back
    return "success_node"

graph.add_conditional_edges("process_node", validate_output)
```

Hoặc với `Command` primitive (combines update + routing):

```python
def my_node(state: State) -> Command[Literal["retry_node"]]:
    if validation_fails(state):
        return Command(
            update={"error": "validation failed"},
            goto="retry_node"
        )
```

### Human-in-the-loop primitive

```python
def human_review(state: State):
    answer = interrupt("Approve this action?")
    return {"decision": answer}

# Resume:
result = graph.invoke({"messages": [...]}, config)
result = graph.invoke(Command(resume="approved"), config)
```

→ `interrupt()` pauses execution, exposes prompt to user. `Command(resume=...)` continues. Native HITL pattern.

### Persistent state (checkpointing)

```python
graph = builder.compile(
    checkpointer=PostgresSaver.from_conn_string("postgresql://..."),
    recursion_limit=25
)
```

Thread IDs cho multi-turn conversations với automatic state restoration. Pause hôm nay, resume ngày mai.

### Implication cho ta

Ta có thể dùng LangGraph (literal hoặc conceptual) để model workflow:

```
START → extract-from-code (node) → extract-from-doc (node) → merge (node) →
   validate (node) → conditional-edge:
     - all-pass → render
     - has-gaps → gap-report (node) → interrupt-for-fill →
       receive-fill → loop back to validate
```

Ngay cả không dùng LangGraph code, **conceptual model** này áp dụng được.

### Pydantic AI structured output

```python
class FeatureCatalog(BaseModel):
    features: list[Feature]
    @field_validator("features")
    def min_3_ac(cls, v):
        for f in v:
            assert len(f.acceptance_criteria) >= 3
        return v

result = llm.with_structured_output(FeatureCatalog).invoke(prompt)
# Built-in validation; if fails, can retry with error in next prompt
```

→ Schema as code. LLM forced to emit theo Pydantic model. Validation native.

### Sources
- [LangGraph docs](https://docs.langchain.com/oss/python/langgraph/graph-api) — graph API reference
- [Pydantic AI vs LangGraph comparison](https://www.zenml.io/blog/pydantic-ai-vs-langgraph)
- [LangGraph Review 2025](https://sider.ai/blog/ai-tools/langgraph-review-is-the-agentic-state-machine-worth-your-stack-in-2025)

---

## 4. Microsoft Syntex / SharePoint Premium — AI + HITL

### Confidence threshold pattern (industry consensus)

Three-tier routing:
- **>90% confidence** → auto-approve, no human review
- **70-90% confidence** → human review queue (pre-filled, just confirm/correct)
- **<70% confidence** → auto-reject, escalate or mark gap

### Other key practices

- AI extract metadata + classify documents
- "Optimized models match or exceed human accuracy while processing 50-100x faster"
- "Reduce reliance on manual input, cut processing times, eliminate classification errors that affect compliance"
- Human-in-the-loop review queues for documents below 80% confidence (their default threshold)

### Implication cho ta

Validation hiện tại của ta là binary (pass/fail). Nâng cấp:
- Field có **confidence score** (high/medium/low — đã có trong schema!)
- Routing rule:
  - high → use as-is
  - medium → flag in gap report cho user verify (1 click confirm)
  - low → mark `[CẦN BỔ SUNG]`, không sử dụng

→ User review medium-confidence chỉ vài phút thay vì re-fill toàn bộ.

### Sources
- [Microsoft Syntex docs](https://learn.microsoft.com/en-us/office365/servicedescriptions/sharepoint-syntex-service-description/sharepoint-syntex-service-description)
- [SharePoint Premium overview](https://techcommunity.microsoft.com/blog/sharepoint_premium_blog/introducing-sharepoint-premium-%e2%80%93-the-future-of-ai-powered-content-management-and/3981076)
- [HITL Review Queues 2026 (Mavik Labs)](https://www.maviklabs.com/blog/human-in-the-loop-review-queue-2026/)

---

## 5. DITA / Single-Source Publishing — Multi-Output Pattern

### Core architecture

DITA (Darwin Information Typing Architecture) — IBM-developed, OASIS-managed XML standard:

- **Topics** = reusable atomic units of content
- **Maps** = ordered collection of topics → 1 publication
- **Conref/conkeyref** = transclusion (reuse fragment across topics)
- **DITAVAL** = filtering attributes (audience, platform, product)
- **Output**: same source → HTML, PDF, mobile, e-learning

"Change content in one place → change propagates everywhere."

### Implication cho ta

5 target docs có content overlap:
- Architecture overview xuất hiện ở TKKT (full), TKCS §3.3 (summary), TKCT §2.1 (kế thừa)
- Tech stack ở TKKT §11, TKCS §3.4, TKCT §2.3
- Security policy ở TKKT §10, TKCS §3.5, TKCT §5

**Single-source pattern**: define content fragment **một lần** trong intel/architecture.json, mỗi writer reference + apply audience filter:
- TKKT writer: full prose, KTS audience
- TKCS writer: summary prose, non-tech audience (translate jargon)
- TKCT writer: technical prose, engineer audience

→ Changes ở 1 chỗ propagate. Validate consistency between docs trở thành easy (check FK to same source).

### Sources
- [DITA Open Toolkit](https://www.dita-ot.org/)
- [Wikipedia DITA](https://en.wikipedia.org/wiki/Darwin_Information_Typing_Architecture)
- [Componize: Structured Authoring](https://componize.com/blog/what-is-structured-content-authoring/)
- [Madcap blog on DITA implementation](https://www.madcapsoftware.com/blog/structured-authoring-dita/)

---

## 6. Docs-as-Code + CI/CD + Provenance (SLSA)

### Core practices (industry consensus 2025)

- **Schema validation in CI/CD** — verify implementation matches spec
  - Healthcare case study: 47 schema drift cases → 0 in 6 weeks
  - Production incidents 0.2/month with continuous validation
- **Provenance attestations** — SLSA framework (Supply chain Levels for Software Artifacts)
- **Build artifacts**: container image (digest) + SBOM + test reports + coverage + provenance attestations
- **Cosign** — signature + attestation verification tool
- **AI-assisted pipelines (2025)** — auto-generate configs/tests/rollback strategies

### Implication cho ta

Provenance pattern đã industry-standard từ supply chain security:
- SBOM = "what's in the build"
- Attestation = "who built it, when, with what inputs"
- Signature = "verified source"

Áp dụng vào docs:
- Each intel field: source (code:routes[5]) + producer (from-code) + timestamp + signature (file hash)
- Schema validation pipeline = CI gate
- Drift detection ↔ schema sha256 mismatch

### Sources
- [Pipeline as Code (TechTarget)](https://www.techtarget.com/searchAppArchitecture/tip/Pipeline-as-Code-Managing-CI-CD-complexity-and-sprawl)
- [Schema Validation for AI agents (Dreamfactory)](https://blog.dreamfactory.com/schema-validation-openapi-ai-agents)
- [CI/CD Best Practices for Skills](https://skywork.ai/blog/ai-agent/ci-cd-best-practices-skills-branching-approvals-rollouts/)
- [Continuous Doc Deployment (Read the Docs)](https://docs.readthedocs.com/platform/stable/continuous-deployment.html)

---

## 7. UK GDS Service Standard — Regulated Context

### 14 points (most relevant subset cho us)

- **#8 Iterate and improve frequently** — validates iterative workflow
- **#11 Choose the right tools and technology** — open standards
- **#13 Use and contribute to open standards, common components and patterns** — JSON Schema, DITA, Pydantic
- **#14 Operate a reliable service** — monitoring, SLA

GDS Way emphasizes: reusable components, accessibility-tested patterns, rigorous WCAG 2.1 compliance.

### Implication cho ta

VN gov context có nhiều similarity với UK gov context (regulated, accessibility, open standards). Adopting GDS-like pattern (reusable components + iterative + open standards) phù hợp.

Tuy nhiên: GDS context khác — họ build user-facing services, ta build internal documentation. Less directly applicable than Diátaxis/Docassemble.

### Sources
- [GOV.UK Design System](https://design-system.service.gov.uk/)
- [The GDS Way](https://gds-way.digital.cabinet-office.gov.uk/)
- [Service Standard 14 points](https://www.gov.uk/service-manual/service-standard)

---

## 8. Content Lifecycle States — Industry Standard

### Common states (5+ products surveyed)

| State | Meaning | Permission |
|---|---|---|
| `draft` | being authored | author edit only |
| `in_review` | submitted for review | reviewer can comment/edit |
| `approved` | passed review | publish-eligible, locked |
| `published` | live/released | read-only |
| `archived` | retired | read-only, hidden |
| `awaiting_approval` | review done, waiting decision | locked |

AEM Guides on DITA: created → reviewed → published → reused → revised → retired

### Implication cho ta

Field lifecycle states (proposed in WORKFLOW_DESIGN.md) align với industry pattern. Slight rename for clarity:

| WORKFLOW_DESIGN draft | Industry-aligned |
|---|---|
| `not-set` | `not-set` (OK) |
| `extracted` | `auto_extracted` (clearer) |
| `verified` | `human_reviewed` (clearer) |
| `manual` | `human_authored` (clearer) |
| `needs-attention` | `flagged_for_review` (industry standard) |
| `placeholder` | `gap_marked` (clearer) |

### Sources
- [AEM Guides Lifecycle (Net Effect)](https://net-effect.com/how-manage-content-lifecycle-in-aem-guides/)
- [Sanity Drafts & Publishing Workflow](https://www.sanity.io/glossary/drafts--publishing-workflow)
- [Contensis Entry workflow states](https://www.contensis.com/help-and-docs/guides/authoring-and-managing-content/entries/entry-workflow-states)

---

## 9. JSON Schema Field Provenance (Pydantic-native)

### Pattern (Pydantic + JSON Schema spec)

```python
from pydantic import BaseModel, Field

class FeatureField(BaseModel):
    value: str
    _provenance: ProvenanceMetadata = Field(
        ..., 
        json_schema_extra={"x-provenance": True}
    )
```

`json_schema_extra` allows adding ANY metadata to JSON Schema output. `Field(...)` per-field customization.

### Data Trust Alliance pattern

Provenance schema split into 3 groups:
- **Source** — who provided the data
- **Provenance** — methodology used to collect/generate/compile
- **Use** — terms for downstream use

→ Áp dụng vào ta:
- Source: `from-code | from-doc | manual | kb`
- Provenance: extraction method (AST parse, doc-intel agent, BA interview, kb_query)
- Use: for which target doc (TKKT/TKCS/TKCT/HDSD/xlsx)

### Sources
- [JSON Schema Specification](https://json-schema.org/specification)
- [Pydantic JSON Schema docs](https://docs.pydantic.dev/latest/concepts/json_schema/)
- [Data Trust Alliance Provenance Standard](https://github.com/Data-and-Trust-Alliance/json-metadata/blob/main/data-provenance-standards-1.0.0.schema.json)

---

## 10. Document Automation Gap Reports (Industry Standard)

### Pattern consensus (5 products surveyed)

- **Maintain checklist** of required documents/fields per category
- **Compare received vs required** at checkpoints
- **Flag gaps immediately** with clear notification
- **AI pre-check** for completeness before tasks reach humans
- **Dashboards** với SLA + completion rate + error rate metrics

### Healthcare case study (specific)

- Schema drift: 47 cases → 0 in 6 weeks via automated validation
- Integration incidents: down to 0.2/month
- Auto-checks: pre-submission for completeness, missing fields, formatting

### Implication

Validates `/intel-status` skill design as first-class output. Industry has 25+ years experience this pattern (insurance, banking, legal).

---

## SUMMARY — Key Insights for WORKFLOW_DESIGN.md

### 7 Strong Insights (research-backed)

| # | Insight | Source consensus | Apply to design |
|---|---|---|---|
| 1 | **Diátaxis 4-type taxonomy** maps cleanly to 5 docs | Strong (cross-industry adoption) | Tag each doc: TKKT=Reference, TKCS=Reference+Explanation, TKCT=Reference, HDSD=Tutorial+How-to, xlsx=Reference. Writers prompted accordingly |
| 2 | **Dependency-aware question ordering** (Docassemble) > linear forms | Strong (Docassemble = canonical pattern from 2010) | `/intel-fill` builds DAG from field declarations, auto-skip irrelevant questions |
| 3 | **State machine + interrupt() HITL** (LangGraph) > linear pipeline | Strong (modern AI agent best practice) | Conceptual model: workflow as graph; `interrupt()` for gap-fill; checkpointer for resume |
| 4 | **3-tier confidence routing** (Syntex pattern: 90/70%) > binary pass/fail | Strong (HITL industry standard) | Add: high→auto, medium→1-click confirm queue, low→gap |
| 5 | **Single-source content reuse** (DITA conref) for multi-doc | Strong (DITA = 20+ years) | Architecture/security/data sections defined once trong intel, each writer transclude + apply audience filter |
| 6 | **Pydantic structured output** > schema injection into prompt | Strong (LangGraph 1.0 + Pydantic AI 1.0 in 2025) | Skill emit Pydantic-validated output natively, không cần schema-prompt coupling thủ công |
| 7 | **Field lifecycle states** standard naming | Strong (5+ products consensus) | Use industry naming: `auto_extracted/human_reviewed/human_authored/flagged_for_review/gap_marked` |

### 3 Drops (over-engineered or wrong direction)

| # | Original idea (in WORKFLOW_DESIGN.md draft) | Drop reason |
|---|---|---|
| 1 | Tier T1/T2/T3 as primary organizing principle | Demote to secondary tag. Diátaxis type + audience are primary organization |
| 2 | Custom schema-prompt auto-injection logic | Use Pydantic structured output instead — industry-standard, no custom code |
| 3 | "Force render" mode hidden | Make explicit + audit log all forced renders |

### 4 New Additions (from research)

| # | New element | Why |
|---|---|---|
| 1 | Diátaxis tag per doc target | Writer prompts differ per Diátaxis type — không thể dùng cùng template |
| 2 | DAG-based interview engine for `/intel-fill` | Docassemble pattern, proven for 15+ years |
| 3 | LangGraph-style state machine workflow doc (conceptual, not necessarily code) | Visual + auditable; checkpoint resume |
| 4 | Confidence threshold routing (90/70 default) | Industry standard, replace binary validation |

### 1 Surprise

**Diátaxis founder's iterative migration philosophy** ("identify one improvement, implement, repeat") = exact opposite of my "do all at once" SDPA. **User instinct ("không chộp giật, suy nghĩ sâu") aligns với Diátaxis methodology**. Validate user direction.

---

## What This Research Confirms

1. ✅ Workflow phải là cycle, không linear (LangGraph + Docassemble + content lifecycle agree)
2. ✅ Gap report là first-class output (industry consensus)
3. ✅ Per-field provenance là standard practice (SLSA + Data Trust Alliance)
4. ✅ HITL checkpoints với confidence routing (Syntex + Document AI)
5. ✅ Single-source content reuse cho multi-doc (DITA pattern)

## What This Research Changes

1. ⚠ Diátaxis là organizing principle, không phải Tier classification
2. ⚠ `/intel-fill` cần DAG engine (Docassemble pattern), không phải linear interview
3. ⚠ Validation = Pydantic structured output, không custom schema injection
4. ⚠ Confidence là 3-tier (90/70), không binary

## What This Research Surprised

1. ✦ User's "không chộp giật" instinct matches Diátaxis founder's iterative philosophy
2. ✦ Docassemble (15+ years) đã giải quyết vấn đề tương tự — pattern cũ, validated
3. ✦ LangGraph 1.0 vừa ship Oct 2025 — modern primitive cho conceptual model
4. ✦ Microsoft Syntex confidence numbers (90%/70%) là thread đã settled trong industry

---

## Recommended next step

User review research notes → discuss với tôi 7 strong insights → align scope → tôi update WORKFLOW_DESIGN.md theo evidence-backed direction → THEN implementation roadmap.

**Vẫn không implement**. Discussion phase first.
