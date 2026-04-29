# Adapter: `fastapi`

FastAPI (0.100+) backend adapter.

## Detect

| Confidence | Signals |
|---|---|
| HIGH | `pyproject.toml` / `requirements.txt` has `fastapi` AND main module creates `FastAPI()` instance |
| MEDIUM | `fastapi` in deps but no clear entry (library?) |
| LOW | `starlette` only (FastAPI's base) |
| NONE | No FastAPI/starlette deps |

Version detection: parse `fastapi==X.Y.Z` or `fastapi = "^X.Y.Z"` (Poetry).

## adapter.yaml highlights

```yaml
id: fastapi
display_name: FastAPI
kind: backend
languages: [python]

detect:
  file_globs: ["**/pyproject.toml", "**/requirements*.txt", "**/main.py", "**/app.py"]
  content_patterns:
    high:
      - { glob: "**/*.py", contains: "FastAPI(" }
      - { glob: "**/pyproject.toml", contains: "fastapi" }

queries:
  routes:
    language: python
    # @app.get / @app.post / @router.get / etc.
    query: |
      (decorated_definition
        (decorator
          (call
            function: (attribute
              object: (identifier) @app-ref
              attribute: (identifier) @http-method
              (#match? @http-method "^(get|post|put|patch|delete|options|head|api_route|websocket)$"))
            arguments: (argument_list (string) @path)))
        definition: (function_definition name: (identifier) @handler-name))

  routers:
    language: python
    # APIRouter instantiation + inclusion
    query: |
      (call
        function: (identifier) @fn (#eq? @fn "APIRouter")
        arguments: (argument_list (keyword_argument
          name: (identifier) @kw (#eq? @kw "prefix")
          value: (string) @prefix)?))
      (call
        function: (attribute
          object: (identifier) @app-ref
          attribute: (identifier) @fn (#eq? @fn "include_router"))
        arguments: (argument_list (identifier) @router-var ...))

  entities:
    language: python
    # SQLAlchemy declarative models + Pydantic models
    query: |
      (class_definition
        superclasses: (argument_list (identifier) @base
          (#match? @base "^(Base|DeclarativeBase|BaseModel|SQLModel)$"))
        name: (identifier) @entity-name)

  auth:
    language: python
    # Dependency-based: Depends(get_current_user), security schemes
    query: |
      (call
        function: (identifier) @fn (#eq? @fn "Depends")
        arguments: (argument_list (identifier) @dep-fn))

i18n:
  file_globs:
    - "**/locales/*/LC_MESSAGES/*.po"    # gettext
    - "**/i18n/*.json"                    # custom

tests:
  file_globs:
    - "**/test_*.py"
    - "**/*_test.py"
    - "**/tests/**/*.py"
```

## extract.py — key functions

### `resolve_routes(decorator_matches, router_matches)`

```python
app = FastAPI()
router = APIRouter(prefix="/api/v1/orders", tags=["orders"])

@router.get("/{order_id}")
async def get_order(order_id: int, current_user=Depends(get_current_user)): ...

app.include_router(router)
```

Resolution:
1. Build map `router_var → prefix` from APIRouter instantiations
2. For each decorator match:
   - Identify app_ref (`app` direct or `router` var)
   - Concatenate: router_prefix (if any) + method path arg
   - Handler body params: parse for `Depends(X)` → auth inference
3. Follow `include_router(router, prefix="/additional")` chains

### `resolve_entities()`

Priority:
1. **Alembic migrations** in `alembic/versions/` — authoritative schema
2. **SQLAlchemy models** — `class Order(Base)` with `Column`, `relationship`, `ForeignKey`
3. **SQLModel** — hybrid Pydantic + SQLAlchemy models
4. **Pydantic BaseModel** — often used as DTOs, not pure entities. Distinguish by presence of `__tablename__` or SQLAlchemy markers

Each entity:
- Fields from `Mapped[T]` annotation or `Column(Type, nullable=, ...)`
- Relationships from `relationship("Target", back_populates=...)` + FK columns
- Check constraints from `CheckConstraint`, `UniqueConstraint`
- PII: field names (email, phone, ccid, ...) + `Column(String, info={"pii": True})` convention if used

### `normalize_auth_scope(dependency)`

FastAPI auth is dependency-driven; adapter maps common patterns:
- `Depends(get_current_user)` / `Depends(oauth2_scheme)` → `authenticated`
- `Depends(require_admin)` → `role:admin` (infer from function name)
- `Security(oauth2_scheme, scopes=["orders:read"])` → `scope:orders:read`
- No `Depends` + no `Security` → `anonymous`

Dependency resolution walks one level deep: if `get_current_user` itself calls `Depends(oauth2_scheme)`, adapter notes the chain.

### `extract_di_graph()`

Python FastAPI DI is via `Depends()`. Edges:
- `{from: handler, to: dep_function, kind: factory}`

Also follow `Depends(SomeClass)` where `__call__` is defined (class-based dependencies).

Module structure:
- Collect all top-level imports per module
- Resolve cross-module calls for component boundary inference

### `extract_integrations()`

- HTTP outbound: `httpx.AsyncClient`, `requests`, `aiohttp`
- MQ: `aio-pika`, `kombu`, `celery` (patterns: `@celery_app.task`, `Celery("...")`), `confluent-kafka`, `aiokafka`
- Cache: `redis.asyncio`, `aioredis`
- Storage: `boto3.client('s3')`, `minio`, `google-cloud-storage`
- DB: SQLAlchemy engine URL from config (env var pattern)
- Background tasks: `BackgroundTasks` param → internal scheduler

### `extract_feature_flags()`

- Config classes using `pydantic_settings.BaseSettings` with `ENABLE_X: bool` fields
- Custom `os.getenv("FEATURE_X", "false").lower() == "true"` patterns
- Unleash / LaunchDarkly Python SDK usage

### Async considerations

- `async def` handlers have same shape as sync for extraction purposes
- Cyclomatic counting includes `async for`, `async with`
- Stub detection: `raise NotImplementedError()`, body only contains `pass`, or returns `{}` / `[]` literal

## Pydantic validators → business rules

FastAPI route handlers take Pydantic request models:
```python
class CreateOrderRequest(BaseModel):
    customer_id: UUID
    items: list[OrderItem] = Field(..., min_length=1, max_length=50)

    @field_validator("items")
    def items_unique(cls, v):
        ids = [i.product_id for i in v]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate product in order")
        return v
```

Extraction:
- `Field(min_length, max_length, gt, ge, ...)` → validation rule (type: Validation)
- `@field_validator` / `@model_validator` → rule with severity High
- Source: `{file}:{line}`

These feed `code-brief §5 Business Rules`.

## Limitations (v1)

- Dynamic route registration (`app.add_api_route()` programmatic) detected but handler binding fuzzier
- Class-based views (APIRouter subclassing) not common in FastAPI; not specially handled
- GraphQL via Strawberry / Ariadne: partial (resolvers detected, schema reconstruction limited)
- Celery task routes not counted as "routes" but as integrations (kind=mq-consumer)
- gRPC via grpcio: separate adapter would be needed

## Known stacks tested

| Stack | Notes |
|---|---|
| FastAPI + SQLAlchemy 2.0 + Postgres | Full support |
| FastAPI + Tortoise ORM | Partial — entities extracted, migrations limited |
| FastAPI + Beanie (Motor/MongoDB) | Partial |
| FastAPI + SQLModel | Full support |
| FastAPI + Celery worker | Full for tasks as mq-consumers |
| FastAPI + Strawberry GraphQL | Partial resolvers |
