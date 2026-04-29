# Stage 2c — Code Fact Extract (Deterministic, Always Runs)

**Stage**: 2 ANALYSIS, sub-step 2.4 (always parallel with 2a or 2b)

**ROLE**: Non-LLM fact extractor. Runs PARALLEL with Stage 2a (s2a-doc-harvester) (or alone in Path B).

**PRINCIPLE**: Zero LLM reasoning. Pure bash/grep/parse. Returns objective facts, no prose.

**OUTPUT**: `{DOCS_PATH}/intel/code-facts.json` (~2–3K tokens)

**RUNTIME**: ~2–5 seconds

---

## Why hybrid (not pure Path A)

Path A (docs-only) misses:
- Version numbers precision (docs say "Next.js 15", code says "15.0.1")
- Actual route count (docs list top APIs, code has all)
- Actual entity count
- Container replica count

Path B (code-only) misses business context.

**Hybrid = Path A prose + Path B Light facts**. 1B always runs, ~3K tokens, no LLM.

---

## Invocation

Single command, bundled script:
```bash
bash "$ENGINE/tools/extract_code_facts.sh" "$PROJECT_ROOT" "{DOCS_PATH}/intel/code-facts.json"
```

---

## Extraction scope

### 1. Tech stack versions

- `package.json` → `.dependencies` + `.devDependencies`
- `pyproject.toml`, `requirements.txt`
- `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`

### 2. Docker services

- `docker-compose*.yml` — services, ports, replicas, healthcheck
- `k8s/`, `helm/`, `charts/` — deployment specs

### 3. Routes (controllers)

Heuristic grep for HTTP decorators:
- NestJS: `@(Get|Post|Put|Delete|Patch)(...)`
- FastAPI: `@(app|router).(get|post|put|delete)(...)`
- Spring: `@(Get|Post|Put|Delete)Mapping`
- Express: `(router|app).(get|post|put|delete)(...)`
- Next.js: `app/api/**/route.ts`

### 4. Entities

- Prisma: `^model\s+\w+` in `prisma/schema.prisma`
- TypeORM: `@Entity()` annotations
- SQLAlchemy: `class X(Base)` patterns
- JPA: `@Entity` in `*.java`

### 5. Validation constraints (for TC generation)

- class-validator: `@IsNotEmpty|IsEmail|Min|Max|Length|Matches|IsIn|IsUUID`
- Pydantic: `Field(min_length=..., max_length=..., gt=..., le=...)`
- Bean Validation: `@NotNull|NotBlank|Min|Max|Size|Pattern|Email`
- Joi/Zod/Yup schemas

### 6. Env vars

- `.env`, `.env.example`, `.env.template` — names + required/optional

### 7. CI/CD

- `.github/workflows/*.yml` — jobs, has_tests, has_lint
- `.gitlab-ci.yml`, `Jenkinsfile`

### 8. Infrastructure

- Logger: pino/winston/zap/logrus/slog grep
- Metrics: prometheus deps
- Health: grep `/health` or `/healthz` endpoints
- Reverse proxy: nginx.conf/traefik.yml presence

---

## Output schema

```jsonc
{
  "meta": {
    "generated_at": "<ISO>",
    "extractor_version": "1B-v1",
    "project_root": "<path>",
    "extraction_runtime_ms": 2500
  },
  "tech_stack": [
    {"layer": "backend", "name": "@nestjs/core", "version": "10.3.0", "source": "package.json"}
  ],
  "docker": {
    "compose_file": "docker-compose.yml",
    "services": {
      "api": {"image": "node:20-alpine", "ports": ["3000:3000"],
              "replicas": 2, "healthcheck": true, "depends_on": ["db", "redis"]}
    }
  },
  "routes": [
    {"method": "POST", "path": "/api/v1/auth/login", "file": "src/auth/auth.controller.ts", "line": 24}
  ],
  "entities": [
    {"name": "User", "file": "prisma/schema.prisma", "line": 42}
  ],
  "validation_constraints": [
    {"file": "src/users/dto/create.dto.ts", "line": 12, "decorator": "IsEmail", "args": ""},
    {"file": "src/users/dto/create.dto.ts", "line": 14, "decorator": "Length", "args": "1, 200"}
  ],
  "env_vars": [
    {"name": "DATABASE_URL", "source": ".env.example", "required": true}
  ],
  "ci_cd": {
    "platform": "github-actions",
    "workflows_count": 3,
    "has_tests": true,
    "has_lint": true
  },
  "infrastructure": {
    "logger": "pino",
    "has_metrics": true,
    "healthcheck_endpoint": "/health"
  },
  "summary": {
    "total_dependencies": 87,
    "total_routes": 45,
    "total_entities": 14,
    "total_validations": 32
  }
}
```

---

## Usage in Phase 3 specialists

- TKKT Writer (03b): `tech_stack`, `docker.services`, `entities`, `routes` (AUTHORITATIVE)
- TKCT Writer (03d): `entities` (column-level), `routes` (param-level), `validation_constraints`
- xlsx Writer (03f): `validation_constraints` (boundary TC generation), `routes` (API TCs)

Cross-reference (Stage 5b Pass 2): content-data values must match code-facts.

---

## Comparison

| Approach | Tokens | Runtime | Facts |
|---|---|---|---|
| Path B full agent scan | ~40K LLM | 2–3 min | Same facts |
| Stage 2c script (this) | ~3K | 2–5 sec | Same facts |

13× faster, 15× cheaper, same data.

---

## Anti-patterns

- ❌ Agent re-write this as LLM prompt (defeats purpose)
- ❌ Agent ask user for facts when script extracts
- ❌ Skip 1B in Path A (miss version precision)
