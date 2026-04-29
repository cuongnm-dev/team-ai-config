# Adapter: `nestjs`

NestJS (9+) backend adapter.

## Detect

| Confidence | Signals |
|---|---|
| HIGH | `package.json` deps include `@nestjs/core` AND `@nestjs/common` AND `main.ts` with `NestFactory.create` |
| MEDIUM | `@nestjs/core` in package.json without clear entry |
| LOW | Only `@nestjs/*` utility packages |
| NONE | No NestJS dependencies |

Version detection: parse `"@nestjs/core": "^X.Y.Z"`.

## adapter.yaml highlights

```yaml
id: nestjs
display_name: NestJS
kind: backend
languages: [typescript]

detect:
  file_globs: ["**/package.json", "**/main.ts"]
  content_patterns:
    high:
      - { glob: "**/package.json", contains: "@nestjs/core" }
      - { glob: "**/main.ts", contains: "NestFactory.create" }

queries:
  routes:
    language: typescript
    query: |
      # Controller decorator + method decorators
      (class_declaration
        (decorator (call_expression
          function: (identifier) @ctrl (#eq? @ctrl "Controller")
          arguments: (arguments (string)? @prefix)))
        name: (type_identifier) @controller-name
        body: (class_body
          (method_definition
            (decorator (call_expression
              function: (identifier) @http-method
              (#match? @http-method "^(Get|Post|Put|Patch|Delete|Options|Head|All)$")
              arguments: (arguments (string)? @path-segment)))
            name: (property_identifier) @handler-name)))

  entities:
    language: typescript
    # TypeORM @Entity / Prisma-generated types / Mongoose schemas
    query: |
      (decorator (call_expression
        function: (identifier) @dec (#eq? @dec "Entity")
        arguments: (arguments (string)? @table-name)))

  auth:
    language: typescript
    # @UseGuards(AuthGuard, RolesGuard), @Roles('admin'), @Public()
    query: |
      (decorator (call_expression
        function: (identifier) @dec
        (#match? @dec "^(UseGuards|Roles|Public|SetMetadata)$")
        arguments: (arguments) @args))

  providers:
    language: typescript
    query: |
      (decorator (call_expression
        function: (identifier) @dec (#eq? @dec "Injectable")))

i18n:
  file_globs:
    - "**/src/i18n/**/*.json"
  # nestjs-i18n convention: {lang}/{namespace}.json

tests:
  file_globs:
    - "**/*.spec.ts"
    - "**/test/**/*.e2e-spec.ts"
```

## extract.py — key functions

### `resolve_routes(controller_matches)`

NestJS composes paths:
```typescript
@Controller('orders')
export class OrdersController {
  @Get(':id')
  findOne(@Param('id') id: string) { ... }
}
```
→ path = `/orders/:id`

- Controller prefix from `@Controller(arg)` (default `''`)
- Method-level path from `@Get(arg)` / etc. (default `''`)
- Global prefix from `app.setGlobalPrefix('api')` in main.ts → prepend to all routes
- Versioning from `@Version('1')` or `app.enableVersioning()`

### `resolve_entities()`

Source preference:
1. **TypeORM** — `@Entity()` classes with `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, ...
2. **Prisma** — parse `schema.prisma` (adapter embeds a minimal Prisma parser)
3. **Mongoose** — `@Schema()` from `@nestjs/mongoose` + `@Prop()`
4. **Migrations** — TypeORM migrations in `src/migrations/` or `db/migrations/`

PII detection:
- Decorator `@Exclude()` from class-transformer (hidden in response)
- Property name heuristics (same as other adapters)
- Database column names matching PII patterns

### `normalize_auth_scope(decorator_args)`

- `@UseGuards(AuthGuard())` → `authenticated`
- `@UseGuards(JwtAuthGuard)` → `authenticated` (JWT variant)
- `@Roles('admin', 'manager')` → `role:admin`, `role:manager`
- `@SetMetadata('permissions', ['orders:read'])` → `scope:orders:read`
- `@Public()` → `anonymous`
- Controller-level `@UseGuards(...)` propagates to all methods unless overridden

### `extract_di_graph()`

NestJS uses constructor injection heavily:
```typescript
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private readonly paymentService: PaymentService,
    private readonly eventBus: EventBus,
  ) {}
}
```

Edges with tokens:
- `{from: OrderService, to: Repository<Order>, kind: constructor-inject}`
- Module-level providers from `@Module({ providers: [...] })` declare what's available

Walk module imports chain for scope:
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([Order]), EventsModule],
  providers: [OrderService, OrderResolver],
  controllers: [OrdersController],
})
```
→ `OrdersModule` depends on `TypeOrmModule`, `EventsModule`.

### `extract_integrations()`

- HTTP: `@nestjs/axios` HttpService, raw axios/fetch
- MQ: `@nestjs/microservices` ClientProxy (Kafka, RMQ, Redis, NATS, gRPC), `@nestjs/bull`/`bullmq`
- Cache: `@nestjs/cache-manager`, `ioredis`
- Storage: `@aws-sdk/*`, `@google-cloud/storage`, `minio`
- Scheduler: `@nestjs/schedule` `@Cron('* * * * *')` → kind=scheduler

### `extract_i18n()`

`nestjs-i18n` package: `src/i18n/{lang}/{namespace}.json`. Parse each, structure namespace per file name.

### CQRS support

If `@nestjs/cqrs` installed:
- `@CommandHandler(CreateOrderCommand)` → synthesize command-handler route with method=RPC
- `@EventHandler(OrderCreatedEvent)` → kind=mq-consumer (internal event bus)
- Extra integration: internal CQRS bus (kind=mq, target=cqrs-bus)

### GraphQL support (partial)

If `@nestjs/graphql` installed:
- `@Resolver()` classes → endpoint type GraphQL
- `@Query()`, `@Mutation()`, `@Subscription()` methods → routes with method=GRAPHQL (normalized to GET/POST based on convention)
- Not fully mapped in v1; flag in warnings `"GraphQL resolvers found but schema-first/code-first mapping limited"`

## Limitations (v1)

- GraphQL schema reconstruction partial (only code-first @Field decorators scanned)
- Microservices (non-HTTP transport) normalized as `method: RPC` with target = pattern
- Guards that dynamically allow/deny (runtime logic) shown as `authenticated` + evidence comment
- `class-validator` DTO rules extracted → business rules §5 of code-brief

## Known stacks tested

| Stack | Notes |
|---|---|
| NestJS 9 + TypeORM + Postgres | Full support |
| NestJS 10 + Prisma | Full support |
| NestJS 10 + Mongoose | Full support |
| NestJS + CQRS + EventStore | Full support for command/event handlers |
| NestJS + GraphQL code-first | Partial (resolvers + basic schema) |
| NestJS microservices (Kafka) | Full — mq routes + consumers |
