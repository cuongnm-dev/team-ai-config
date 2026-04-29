# Framework Adapter Contract

Adapters turn stack-specific source code into the normalized `code-facts.json` schema.
Downstream phases (3–8) NEVER read adapter output directly — only the merged normalized schema.

## Adapter Format (Hybrid)

Each adapter lives in its own folder:

```
adapters/{adapter-id}/
├── adapter.yaml           # metadata + tree-sitter queries (declarative)
├── detect.py              # confidence scoring (Python)
├── extract.py             # complex extraction (Python, tree-sitter bindings)
└── README.md              # user-facing adapter doc
```

- **`adapter.yaml`** handles pattern extraction (routes, entities, auth decorators) — simple,
  declarative tree-sitter queries. No code needed for 60% of cases.
- **`detect.py`** implements `detect(repo_path) → Confidence`.
- **`extract.py`** implements complex logic that pattern matching can't do:
  DI graph traversal, entity FK resolution, inherited route prefix walking, etc.

## Adapter Interface (Python)

```python
from dataclasses import dataclass
from typing import Literal

Confidence = Literal["HIGH", "MEDIUM", "LOW", "NONE"]

@dataclass
class DetectResult:
    confidence: Confidence
    signals: list[str]       # e.g. ["found *.csproj", "Program.cs has WebApplication"]
    version: str | None       # detected framework version if possible

class Adapter:
    id: str                   # "dotnet-aspnetcore"
    display_name: str         # "ASP.NET Core"

    def detect(self, repo_path: str) -> DetectResult: ...
    def extract_routes(self, repo_path: str) -> list[Route]: ...
    def extract_entities(self, repo_path: str) -> list[Entity]: ...
    def extract_auth(self, repo_path: str) -> list[AuthRule]: ...
    def extract_integrations(self, repo_path: str) -> list[Integration]: ...
    def extract_di_graph(self, repo_path: str) -> ComponentGraph: ...
    def extract_i18n(self, repo_path: str) -> I18nMap: ...
    def extract_test_map(self, repo_path: str) -> TestMap: ...
```

All methods are best-effort. Return empty list if not applicable (e.g. a BE-only adapter returns
empty `i18n` — FE adapter will fill it).

## adapter.yaml Schema

```yaml
id: dotnet-aspnetcore
display_name: ASP.NET Core
detect:
  file_globs:
    - "**/*.csproj"
    - "**/Program.cs"
  content_patterns:
    high:
      - glob: "**/*.csproj"
        contains: "Microsoft.AspNetCore"
      - glob: "**/Program.cs"
        contains: "WebApplication.CreateBuilder"
    medium:
      - glob: "**/Startup.cs"
        contains: "IApplicationBuilder"

queries:
  # Tree-sitter S-expression queries per language
  routes:
    language: c_sharp
    query: |
      (attribute
        name: (identifier) @attr-name
        (#match? @attr-name "^(HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch|Route)$")
        arguments: (attribute_argument_list
          (attribute_argument (string_literal) @path)?))
      (method_declaration
        name: (identifier) @handler)
    post_process: "extract.resolve_route_prefix"    # hook into extract.py

  entities:
    language: c_sharp
    query: |
      (class_declaration
        bases: (base_list (identifier) @base
          (#match? @base "DbContext$"))
        body: (declaration_list
          (property_declaration
            type: (generic_name
              name: (identifier) @set-type
              (#eq? @set-type "DbSet")
              type_arguments: (type_argument_list (identifier) @entity-name)))))

  auth:
    language: c_sharp
    query: |
      (attribute
        name: (identifier) @attr
        (#match? @attr "^(Authorize|AllowAnonymous)$")
        arguments: (attribute_argument_list)? @args)

  # More queries...

integrations:
  # Outbound HTTP
  - pattern: "HttpClient|RestClient|IHttpClientFactory"
    kind: http-outbound
  - pattern: "RabbitMQ.Client|MassTransit|NServiceBus"
    kind: mq
  - pattern: "StackExchange.Redis"
    kind: cache

i18n:
  file_globs:
    - "Resources/**/*.resx"
    - "**/i18n/**/*.json"

tests:
  file_globs:
    - "**/*Tests.cs"
    - "**/*.Tests/**/*.cs"
```

## Normalized Output Shape

See [../schemas/code-facts.schema.json](../schemas/code-facts.schema.json) for authoritative schema.
Every adapter output must validate against that schema.

Key fields each adapter contributes:

```yaml
# Route (normalized — stack-agnostic)
- id: R-001
  method: GET
  path: /api/orders/{id}
  handler_symbol: OrdersController.GetOrder      # adapter-normalized name
  handler_file: src/Controllers/OrdersController.cs
  handler_line: 42
  handler_loc: 18                                # for completeness scoring
  auth_scope: ["authenticated", "role:admin"]    # unified vocabulary
  entities_touched: [Order, OrderItem]
  is_stub: false                                 # adapter best-effort
  adapter: dotnet-aspnetcore
  confidence: 0.95
```

## Detect Cascade

```
P1.0 All adapters' detect() run in parallel (deterministic, no LLM)
P1.1 Filter:
       HIGH confidence → selected
       MEDIUM only → ask user in R1 (include/exclude)
       LOW / NONE → ignored unless user adds manually
P1.2 Multi-adapter scenarios common (BE + FE):
       {dotnet-aspnetcore: HIGH, angular: HIGH}  → run both
P1.3 If all NONE AND no user override → Tier 3 LLM fallback
P1.4 Selected adapters extract in parallel
P1.5 Merge outputs → normalized code-facts.json
        Conflict policy: prefer adapter with HIGHER confidence on overlapping files
        If tie: prefer adapter matching current file's language
```

## Adding a New Adapter (User Guide)

1. Copy `adapters/_template/` → `adapters/{your-adapter-id}/`
2. Fill `adapter.yaml` (detect rules + tree-sitter queries for routes/entities/auth)
3. Implement `detect.py` (return HIGH/MED/LOW/NONE with evidence)
4. Override `extract.py` methods only for patterns `adapter.yaml` can't express
5. Add entry to `adapters/registry.json`
6. Write `README.md` with supported version range + known limitations
7. Test against 2+ real projects; add fixtures in `adapters/{id}/fixtures/`

## v1 Shipped Adapters

| Adapter | File | Supported versions | Limitations |
|---|---|---|---|
| `dotnet-aspnetcore` | [dotnet-aspnetcore.md](dotnet-aspnetcore.md) | ASP.NET Core 6+ | Minimal APIs partial (v1), EF Core migrations preferred |
| `angular` | [angular.md](angular.md) | Angular 14+ | Standalone components supported, NgModule legacy ok |
| `nestjs` | [nestjs.md](nestjs.md) | NestJS 9+ | CQRS module optional; GraphQL partial |
| `fastapi` | [fastapi.md](fastapi.md) | FastAPI 0.100+ | Pydantic v1+v2, SQLAlchemy 1.4+2.0 |

All other stacks → Tier 1 universal primitives + Tier 3 LLM fallback.

## Common Vocabulary (enforced across adapters)

| Concept | Normalized value | Notes |
|---|---|---|
| auth_scope | `anonymous \| authenticated \| role:{name} \| policy:{name} \| scope:{name}` | Adapters translate their native form |
| entity source | `migration \| orm-model \| code-first-attribute \| sql-script` | Migration preferred for PII + state machine detection |
| integration kind | `http-outbound \| http-inbound \| mq-producer \| mq-consumer \| cache \| storage \| auth-provider \| db` | |
| test kind | `unit \| integration \| e2e \| contract` | Inferred from folder + framework |
| status evidence signal | `has_handler \| has_test \| handles_errors \| flag_on \| entity_resolved \| no_todo` | Each with file:line |

Adapters that cannot classify exactly → use `unknown` and validator flags for user review.
