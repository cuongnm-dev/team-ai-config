# Adapter: `angular`

Angular (14+) frontend adapter.

## Detect

| Confidence | Signals |
|---|---|
| HIGH | `angular.json` exists AND `package.json` deps include `@angular/core` |
| MEDIUM | `@angular/core` in package.json without `angular.json` (library?) |
| LOW | Only `@angular/*` sub-packages |
| NONE | No Angular dependencies |

Version detection: parse `"@angular/core": "^X.Y.Z"` → major version.

## adapter.yaml highlights

```yaml
id: angular
display_name: Angular
kind: frontend
languages: [typescript]

detect:
  file_globs: ["**/angular.json", "**/package.json"]
  content_patterns:
    high:
      - { glob: "**/angular.json", contains: "\"projects\"" }
      - { glob: "**/package.json", contains: "@angular/core" }

queries:
  routes:
    language: typescript
    # RouterModule.forRoot([...]) / forChild([...]) / provideRouter()
    query: |
      (call_expression
        function: (member_expression
          object: (identifier) @rm (#eq? @rm "RouterModule")
          property: (property_identifier) @fn (#match? @fn "^for(Root|Child)$"))
        arguments: (arguments (array) @routes))
      (call_expression
        function: (identifier) @pr (#eq? @pr "provideRouter")
        arguments: (arguments (array) @routes))

  components:
    language: typescript
    query: |
      (decorator
        (call_expression
          function: (identifier) @dec (#eq? @dec "Component")
          arguments: (arguments (object) @meta)))

  guards:
    language: typescript
    query: |
      # CanActivate / CanLoad / CanDeactivate
      (class_declaration
        (class_heritage
          (implements_clause (type_identifier) @iface
            (#match? @iface "^Can(Activate|Load|Deactivate|Match)$")))
        name: (type_identifier) @guard-name)

  services:
    language: typescript
    query: |
      (decorator
        (call_expression
          function: (identifier) @dec (#eq? @dec "Injectable")
          arguments: (arguments (object)? @meta)))

i18n:
  file_globs:
    - "**/src/assets/i18n/*.json"
    - "**/src/locale/messages.*.xlf"
  default_locale_detect:
    source: "angular.json"
    path: "projects.*.i18n.sourceLocale"

tests:
  file_globs:
    - "**/*.spec.ts"
    - "**/cypress/**/*.cy.ts"
    - "**/e2e/**/*.ts"
  describe_query:
    language: typescript
    query: |
      (call_expression
        function: (identifier) @fn (#match? @fn "^(describe|it|test)$")
        arguments: (arguments (string) @text))
```

## extract.py — key functions

### `resolve_routes(route_array_ast)`

Angular routes are nested:
```typescript
const routes: Routes = [
  { path: 'orders', loadChildren: () => import('./orders/orders.module').then(m => m.OrdersModule) },
  { path: 'orders/:id', component: OrderDetailComponent, canActivate: [AuthGuard] },
];
```

Walk recursively:
- Concatenate parent `path` → full route path
- Resolve `loadChildren` → lazy module → follow `RouterModule.forChild(...)` inside that module
- `component` → Angular component class (FE "handler")
- `canActivate/canLoad` → auth_scope via guard name

Normalized route entry:
```yaml
- id: R-N
  service_id: web
  method: GET        # frontend routes are always GET (SPA)
  path: /orders/:id
  handler_symbol: OrderDetailComponent
  handler_file: src/app/orders/order-detail/order-detail.component.ts
  auth_scope: [policy:AuthGuard]   # derived from guard name, normalized in P5 if user clarifies
  entities_touched: []             # frontend rarely touches entities directly; derived via service calls
  adapter: angular
```

Frontend "routes" are displayed as screens (see §7 UI inventory in code-brief).

### `resolve_components(decorator_matches)`

Each `@Component({selector, templateUrl, styleUrls})`:
- Extract selector, template file path
- Parse template (via tree-sitter HTML) for nested component tags → component tree
- Collect `@Input()` / `@Output()` properties → public contract

### `extract_services_for_entity_inference(components)`

Frontend doesn't have "entities" directly. Angular services (`HttpClient` usage) reference backend endpoints:
```typescript
this.http.get<Order[]>(`/api/orders`);
this.http.post<Order>('/api/orders', payload);
```

Parse `http.{get,post,put,patch,delete}` calls → extract URL + generic type arg.
Use these to:
- Correlate FE routes with BE routes (cross-service feature clustering)
- Infer entity types from generic args (`<Order[]>`)

### `extract_guards(matches)` → auth_rules

Guard class → synthesized auth_rule:
```yaml
- scope: policy:{GuardName}
  applies_to: {routes using this guard in canActivate}
  source_file: {guard-file}
  source_line: {class decl line}
  evidence: "class AuthGuard implements CanActivate { ... }"
```

### `extract_i18n_angular()`

Two common forms:
1. **ngx-translate JSON** (`src/assets/i18n/vi.json`):
   ```json
   { "orders": { "list": { "title": "Danh sách đơn hàng", "createBtn": "Tạo mới" } } }
   ```
   Flatten to `orders.list.title: "Danh sách..."` keys.

2. **Angular built-in `$localize`** + xlf:
   - Parse `messages.vi.xlf` → `<trans-unit id="..."><source>...</source><target>Danh sách...</target></trans-unit>`
   - Flat keys by id.

### `extract_di_graph()`

Constructor-injected services:
```typescript
constructor(private orderService: OrderService, private route: ActivatedRoute) {}
```

Edges: `{from: ComponentName, to: ServiceName, kind: constructor-inject}`.

## Standalone Components (v14+)

```typescript
@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  ...
})
```

- No NgModule needed; `bootstrapApplication` + `provideRouter([...])` is the entry
- DI via `@Injectable({ providedIn: 'root' })` tree-shakable singletons
- Tests: component usage directly rather than TestBed module compilation

Adapter detects both patterns and normalizes uniformly.

## Feature correlation with backend adapter

When `angular` + `dotnet-aspnetcore` (or any backend adapter) both present:
- P3a clustering uses shared URL path pattern (FE `/api/orders` call matches BE `/api/orders` route)
- Cluster across service_id when URL + entity overlap ≥ 0.6

This means a "feature" can span frontend screens + backend routes — which is correct business framing.

## Limitations (v1)

- NGRX store not parsed as "entity" source (may be a future enhancement)
- Template binding analysis limited to tag names (not full template grammar)
- Reactive forms validation rules extracted only if declared with `Validators.X` inline; custom validator classes supported
- Material / Primeng UI library components not distinguished from custom components

## Known stacks tested

| Stack | Notes |
|---|---|
| Angular 14 NgModule | Full support |
| Angular 15 + standalone | Full support |
| Angular 17 new-style `@for` / `@if` control flow | Supported |
| Angular Universal (SSR) | Partial (client routes only; server routes require extra scan) |
| Nx workspace with multiple Angular apps | Each app treated as separate service |
