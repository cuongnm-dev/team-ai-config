# Adapter: `java-spring`

Spring Boot (2.7+, 3.x) backend adapter.

## Detect

| Confidence | Signals |
|---|---|
| HIGH | `pom.xml` or `build.gradle` with `spring-boot-starter-*` deps AND a class with `@SpringBootApplication` |
| MEDIUM | `spring-core` / `spring-context` only (non-Boot Spring) |
| LOW | Java sources with `@Component` but no Spring deps |
| NONE | No Spring dependencies |

Version detection:
- Maven: `<spring-boot.version>` property or `<parent>` spring-boot-starter-parent version
- Gradle: `id 'org.springframework.boot' version 'X.Y.Z'`

## adapter.yaml highlights

```yaml
id: java-spring
display_name: Spring Boot
kind: backend
languages: [java, kotlin]

detect:
  file_globs: ["**/pom.xml", "**/build.gradle", "**/build.gradle.kts", "**/*.java", "**/*.kt"]
  content_patterns:
    high:
      - { glob: "**/pom.xml", contains: "spring-boot-starter" }
      - { glob: "**/build.gradle*", contains: "spring-boot" }
      - { glob: "**/*.java", contains: "@SpringBootApplication" }

queries:
  routes:
    language: java
    # @RestController + @RequestMapping / @GetMapping / etc.
    query: |
      (class_declaration
        (modifiers (annotation name: (identifier) @ctrl
          (#match? @ctrl "^(RestController|Controller)$")))
        (modifiers (annotation name: (identifier) @rm (#eq? @rm "RequestMapping")
          arguments: (annotation_argument_list)? @ctrl-path))?
        name: (identifier) @controller-name
        body: (class_body
          (method_declaration
            (modifiers (annotation name: (identifier) @http-anno
              (#match? @http-anno "^(GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping|RequestMapping)$")
              arguments: (annotation_argument_list)? @path))
            name: (identifier) @handler-name)))

  entities:
    language: java
    # JPA @Entity
    query: |
      (class_declaration
        (modifiers (annotation name: (identifier) @anno (#eq? @anno "Entity")))
        name: (identifier) @entity-name)

  auth:
    language: java
    # @PreAuthorize / @Secured / @RolesAllowed
    query: |
      (annotation name: (identifier) @anno
        (#match? @anno "^(PreAuthorize|PostAuthorize|Secured|RolesAllowed|PermitAll|DenyAll)$")
        arguments: (annotation_argument_list)? @args)

  services:
    language: java
    query: |
      (annotation name: (identifier) @anno
        (#match? @anno "^(Service|Component|Repository|RestController|Controller|Configuration)$"))

i18n:
  file_globs:
    - "**/src/main/resources/messages*.properties"
    - "**/src/main/resources/i18n/**/*.properties"
  parser: properties

tests:
  file_globs:
    - "**/src/test/**/*.java"
    - "**/src/test/**/*.kt"
  describe_query:
    language: java
    query: |
      (annotation name: (identifier) @anno
        (#match? @anno "^(Test|ParameterizedTest|RepeatedTest|DisplayName)$"))
```

## extract.py — key functions

### `resolve_routes(controller_matches)`

Spring composes path from controller-level + method-level mapping:
```java
@RestController
@RequestMapping("/api/orders")
public class OrdersController {
    @GetMapping("/{id}")
    public OrderDto getOrder(@PathVariable UUID id) { ... }
}
```

- Controller prefix from `@RequestMapping("value")` / `@RequestMapping(value = "x", path = "y")`
- Method path from `@GetMapping` etc. (default `""`)
- HTTP method from annotation type (`@GetMapping` → GET)
- Global prefix: parse `server.servlet.context-path` from `application.{yml,properties}`
- Versioning: detect via `@RequestMapping(headers = "API-VERSION=v1")` or URL prefix convention

### `resolve_entities()`

Source preference:
1. **Flyway migrations** (`src/main/resources/db/migration/V*.sql`) — authoritative
2. **Liquibase changelogs** (`src/main/resources/db/changelog/*.xml|yaml`)
3. **JPA `@Entity`** classes — parse `@Column`, `@JoinColumn`, `@ManyToOne`, `@OneToMany`, `@Id`
4. **JPA field-level annotations**:
   - `@Id` → primary_key
   - `@Column(unique = true, nullable = false)` → constraints
   - `@Enumerated` → state machine candidate (enum values = states)
   - `@Convert(converter = EncryptedStringConverter.class)` → PII encrypted

### `normalize_auth_scope(anno_args)`

- `@PreAuthorize("hasRole('ADMIN')")` → `role:ADMIN`
- `@PreAuthorize("hasAuthority('SCOPE_orders:read')")` → `scope:orders:read`
- `@PreAuthorize("isAuthenticated()")` → `authenticated`
- `@Secured({"ROLE_ADMIN", "ROLE_MANAGER"})` → `role:ADMIN`, `role:MANAGER`
- `@RolesAllowed` (JSR-250) → similar
- `@PermitAll` → `anonymous`
- Class-level propagates to methods unless overridden

Complex SpEL expressions (`@PreAuthorize("#order.ownerId == principal.id")`) → capture as `policy:custom` with `evidence: {expression}` for user review.

### `extract_di_graph()`

Spring DI primarily via constructor (recommended) or field injection:
```java
@Service
public class OrderService {
    private final OrderRepository orderRepo;
    private final PaymentGateway paymentGateway;

    public OrderService(OrderRepository orderRepo, PaymentGateway paymentGateway) {
        this.orderRepo = orderRepo;
        this.paymentGateway = paymentGateway;
    }
}
```

- Parse constructor params → edges `{from: OrderService, to: OrderRepository, kind: constructor-inject}`
- `@Autowired` field/setter injection → `kind: field-inject` / `property-inject`
- `@Configuration` + `@Bean` methods → factory edges

### `extract_integrations()`

- HTTP outbound: `RestTemplate`, `WebClient`, `Feign` (`@FeignClient`), `HttpClient` (JDK 11+)
- MQ: Spring AMQP (RabbitMQ), Spring Kafka, Spring Cloud Stream, JMS
  - `@RabbitListener`, `@KafkaListener`, `@JmsListener` → mq-consumer
  - `RabbitTemplate`, `KafkaTemplate` → mq-producer
- Cache: Spring Cache (`@Cacheable`, `@CacheEvict`) + underlying provider (Redis, Caffeine, Hazelcast)
- Storage: AWS SDK v2 (`S3Client`), Azure Blob SDK, MinIO client
- Auth provider: Spring Security OAuth2 client → detect issuer-uri from `application.yml`
- Scheduler: `@Scheduled(cron = ...)` → kind=scheduler
- Webhook inbound: controllers under `/webhook*` paths + HMAC verification

### `extract_feature_flags()`

- Togglz library: `@FeatureTag` / `Feature` enum
- Spring Cloud Config with `@ConditionalOnProperty(name = "features.X", havingValue = "true")`
- Custom: `@Value("${features.X:false}")` pattern
- Unleash / LaunchDarkly Java SDK

### Bean validation → business rules

Spring uses JSR-380 (`@NotNull`, `@Size`, `@Pattern`, `@Email`, etc.) + custom `ConstraintValidator`:
```java
public class CreateOrderRequest {
    @NotNull
    private UUID customerId;

    @Size(min = 1, max = 50)
    private List<OrderItem> items;

    @ValidPromoCode  // custom
    private String promoCode;
}
```

Extract:
- Built-in annotations → rule type `Validation`, severity Med
- Custom `@ValidXxx` → follow `@Constraint(validatedBy = XxxValidator.class)` → extract logic hint from validator class
- Source: `{file}:{line}`

Feeds `code-brief §5 Business Rules`.

## Kotlin support

For Kotlin-based Spring Boot:
- Use `tree-sitter-kotlin` instead of `tree-sitter-java`
- Same annotations, different syntax (extension properties, data classes)
- Data classes with `@Entity` → same entity extraction
- `val` vs `var` → nullable inferred from Kotlin type (`String?` = nullable)

## Spring WebFlux (reactive)

Reactive controllers using `Mono<T>` / `Flux<T>` handled same as MVC. Router-function style:
```java
@Bean
public RouterFunction<ServerResponse> orderRoutes(OrderHandler handler) {
    return route(GET("/api/orders/{id}"), handler::getOrder)
        .andRoute(POST("/api/orders"), handler::createOrder);
}
```

Adapter detects `RouterFunction` builders and extracts routes from chain calls. Handler symbol = method reference target (e.g. `OrderHandler.getOrder`).

## Limitations (v1)

- Spring Cloud Gateway route configuration (YAML-based) not parsed; extract at tier-1 config level only
- Spring Batch jobs not mapped as routes (could be integration of kind=scheduler)
- Dynamic controllers via `BeanDefinitionRegistryPostProcessor` not detectable statically
- GraphQL via Spring GraphQL: partial (resolvers detected)
- gRPC via grpc-spring-boot-starter: not supported in v1

## Known stacks tested

| Stack | Notes |
|---|---|
| Spring Boot 2.7 MVC + JPA + Postgres | Full support |
| Spring Boot 3.x MVC + JPA | Full support |
| Spring Boot 3.x WebFlux + R2DBC | Full (reactive) |
| Spring Boot + Kotlin | Full |
| Spring Boot + Kafka | Full for listeners + templates |
| Spring Cloud microservices | Per-service; service discovery config surfaced in stack-context |
