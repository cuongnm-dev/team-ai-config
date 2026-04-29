# Adapter: `dotnet-aspnetcore`

ASP.NET Core (6.0+) backend adapter.

## Detect

| Confidence | Signals (all must hold for HIGH) |
|---|---|
| HIGH | ≥ 1 `*.csproj` referencing `Microsoft.AspNetCore.App` OR `Microsoft.NET.Sdk.Web` AND `Program.cs` with `WebApplication.CreateBuilder` OR `WebHost.CreateDefaultBuilder` |
| MEDIUM | `Startup.cs` with `IApplicationBuilder.UseEndpoints` (legacy pre-6.0 style) |
| LOW | `.NET` references only (console/worker without web) |
| NONE | No C# sources with web markers |

Version detection:
- Parse `<TargetFramework>net8.0</TargetFramework>` from `*.csproj`
- Use highest version if multiple projects

## adapter.yaml highlights

```yaml
id: dotnet-aspnetcore
display_name: ASP.NET Core
kind: backend
languages: [c#]

detect:
  file_globs: ["**/*.csproj", "**/Program.cs", "**/Startup.cs"]
  content_patterns:
    high:
      - { glob: "**/*.csproj", contains: "Microsoft.AspNetCore" }
      - { glob: "**/Program.cs", contains: "WebApplication.CreateBuilder" }
    medium:
      - { glob: "**/Startup.cs", contains: "IApplicationBuilder" }

queries:
  routes:
    language: c_sharp
    # Controller-based
    query: |
      (class_declaration
        (attribute_list (attribute name: (identifier) @ctrl-attr
          (#match? @ctrl-attr "^(ApiController|Controller)$")))
        name: (identifier) @controller-name
        body: (declaration_list
          (method_declaration
            (attribute_list
              (attribute name: (identifier) @http-attr
                (#match? @http-attr "^(HttpGet|HttpPost|HttpPut|HttpPatch|HttpDelete|Route)$")
                arguments: (attribute_argument_list
                  (attribute_argument (string_literal) @route-template)?)))
            name: (identifier) @handler-method)))
    post_process: extract.resolve_controller_prefix

  entities:
    language: c_sharp
    query: |
      # DbContext DbSets
      (class_declaration
        bases: (base_list (identifier) @base (#match? @base "DbContext$"))
        body: (declaration_list
          (property_declaration
            type: (generic_name
              name: (identifier) @gn (#eq? @gn "DbSet")
              type_arguments: (type_argument_list (identifier) @entity-type)))))
    post_process: extract.resolve_entity_properties

  auth:
    language: c_sharp
    query: |
      (attribute
        name: (identifier) @attr
        (#match? @attr "^(Authorize|AllowAnonymous)$")
        arguments: (attribute_argument_list)? @args)
    post_process: extract.normalize_auth_scope

i18n:
  file_globs:
    - "**/Resources/**/*.resx"
    - "**/Resources/**/*.{vi,en}.json"
  parser: resx   # XML parser for .resx; tier-1 handles .json

tests:
  file_globs:
    - "**/*Tests.cs"
    - "**/*.Tests/**/*.cs"
  describe_query:
    language: c_sharp
    query: |
      (method_declaration
        (attribute_list (attribute name: (identifier) @attr
          (#match? @attr "^(Fact|Theory|Test)$")))
        name: (identifier) @test-name)
```

## extract.py — key functions

### `resolve_controller_prefix(matches)`
ASP.NET Core composes route from class-level `[Route("api/[controller]")]` + method attributes.
- Collect class-level `[Route]` or use convention `"api/[controller]"` if controller ends with `Controller`
- Replace `[controller]` with controller name minus "Controller" suffix
- Concatenate with method-level template

### `resolve_entity_properties(entity_name, context)`
For each DbSet entity:
1. Locate entity class file (search project for `class {EntityName}`)
2. Parse properties (Name, Type, nullable via `?`, data annotations)
3. Detect FK from:
   - Navigation properties (`public Order Order { get; set; }`)
   - Foreign key attributes (`[ForeignKey("OrderId")]`)
   - EF Core conventions (`{Entity}Id`)
4. Detect PII via attribute conventions:
   - `[PersonalData]` (Identity), `[ProtectedPersonalData]`
   - Property name heuristics (Email, Phone, CCCD, ...)
5. Preference: migration source over model source
   - If `Migrations/*.cs` present, parse `CreateTable` calls for authoritative field list

### `normalize_auth_scope(attr_args)`
- `[Authorize]` with no args → `authenticated`
- `[Authorize(Roles = "Admin,Manager")]` → `role:Admin`, `role:Manager`
- `[Authorize(Policy = "CanEditOrder")]` → `policy:CanEditOrder`
- `[AllowAnonymous]` → `anonymous`
- Scheme = OAuth scopes → `scope:{name}`

### `extract_di_graph()`
- Parse `Program.cs` service registration:
  - `builder.Services.AddScoped<IOrderService, OrderService>()`
  - `.AddSingleton<T>()`, `.AddTransient<T>()`, `.AddHttpClient<T>()`
- Parse constructors for ctor injection:
  ```csharp
  public OrdersController(IOrderService svc, ILogger<OrdersController> log) { ... }
  ```
- Edges: `{from: "OrdersController", to: "IOrderService", kind: "constructor-inject"}`

### `extract_integrations()`
- HTTP outbound: `IHttpClientFactory` named clients, `HttpClient` direct, `RestSharp.RestClient`, `Refit` interface
- MQ: `RabbitMQ.Client.IConnection`, `MassTransit.IBus`, `NServiceBus.IEndpointInstance`
- Cache: `StackExchange.Redis.IConnectionMultiplexer`
- Storage: `Amazon.S3.IAmazonS3`, `Azure.Storage.Blobs.BlobServiceClient`, `Minio.IMinioClient`
- DB: read connection string env vars from `appsettings*.json` + config pattern

### `extract_feature_flags()`
- IConfiguration `FeatureFlags:{Name}` section
- Microsoft.FeatureManagement (`IFeatureManager.IsEnabledAsync("X")`)
- LaunchDarkly / Unleash SDK usage

## Minimal APIs (v6.0+)

```csharp
app.MapGet("/api/orders/{id}", ...);
app.MapPost("/api/orders", ...).RequireAuthorization("CanEditOrder");
```

v1 support is partial:
- Recognize `MapGet/MapPost/MapPut/MapDelete` calls
- Path from literal string arg
- `.RequireAuthorization("X")` → auth scope
- Handler symbol = caller of Map* if lambda named, else `"Anonymous-{line}"`

## Limitations (v1)

- FluentValidation rules extracted into business rules (§5 of code-brief) only if class extends `AbstractValidator<T>`
- gRPC services not supported (add adapter `dotnet-grpc` if needed)
- SignalR hubs partially supported (hub methods → WS routes)
- EF Core fluent API (`OnModelCreating`) not fully parsed; migrations preferred
- No decompilation of NuGet packages — only first-party source

## Known stacks tested

| Stack | Version | Notes |
|---|---|---|
| ASP.NET Core + EF Core | 6.0, 7.0, 8.0 | Full support |
| ASP.NET Core + Dapper | 8.0 | Entities from migrations only |
| Minimal API + EF Core | 8.0 | Routes partial; DI full |
| Razor Pages | 6.0 | Not well-supported (different routing) |

## Integration with tier-1 primitives

Adapter reuses:
- tree-sitter C# parser via `tree_sitter_languages.get_parser("c_sharp")`
- universal-ctags for fast symbol lookup
- scc/tokei for LOC per file
- grep for TODO markers
