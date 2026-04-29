# Adapter: `react`

React 18+ frontend adapter. Covers common routers (React Router v6+, TanStack Router, Next.js App Router partially) and common stacks (Vite, CRA, Next.js).

## Detect

| Confidence | Signals |
|---|---|
| HIGH | `package.json` with `react` AND (`react-dom` OR Next.js) AND a component tree detected |
| MEDIUM | `react` only (library or SSR-only) |
| LOW | `react` as indirect dep (Storybook / testing) |
| NONE | No React deps |

Sub-variant detection (affects routing extraction):
- `next` in deps → Next.js (App Router if `app/` dir, Pages Router if `pages/` dir)
- `react-router-dom` → React Router v6
- `@tanstack/react-router` → TanStack Router (file-based or code-based)
- `@remix-run/react` → Remix (separate sub-adapter behavior)

Version: parse `"react": "^18.X"`.

## adapter.yaml highlights

```yaml
id: react
display_name: React
kind: frontend
languages: [typescript, javascript]

detect:
  file_globs: ["**/package.json", "**/vite.config.*", "**/next.config.*"]
  content_patterns:
    high:
      - { glob: "**/package.json", contains: "\"react\":" }
      - { glob: "**/package.json", contains: "\"react-dom\":" }

queries:
  # React Router v6 — <Routes><Route path="..." element={<X />} /></Routes>
  react_router_routes:
    language: typescript
    query: |
      (jsx_element
        open_tag: (jsx_opening_element
          name: (identifier) @tag (#eq? @tag "Route")
          attribute: (jsx_attribute
            (property_identifier) @attr-name (#eq? @attr-name "path")
            value: (string) @path)
          attribute: (jsx_attribute
            (property_identifier) @el-name (#eq? @el-name "element")
            value: (jsx_expression (jsx_element
              open_tag: (jsx_opening_element name: (identifier) @component))))))

  # createBrowserRouter / createHashRouter array form
  router_config:
    language: typescript
    query: |
      (call_expression
        function: (identifier) @fn
        (#match? @fn "^(createBrowserRouter|createHashRouter|createMemoryRouter)$")
        arguments: (arguments (array) @route-config))

  components:
    language: typescript
    # Function components (arrow + named) + class components
    query: |
      (function_declaration name: (identifier) @component (#match? @component "^[A-Z]"))
      (lexical_declaration
        (variable_declarator
          name: (identifier) @component (#match? @component "^[A-Z]")
          value: (arrow_function) ))

  hooks_usage:
    language: typescript
    # useQuery, useMutation (React Query), useSWR, fetch API calls
    query: |
      (call_expression
        function: (identifier) @hook
        (#match? @hook "^(useQuery|useMutation|useSWR|useFetch)$"))

i18n:
  file_globs:
    - "**/public/locales/*/*.json"     # next-i18next
    - "**/locales/*/*.json"
    - "**/src/**/translations/**/*.json"
    - "**/src/i18n/**/*.json"
    - "**/lingui/*.po"                  # LinguiJS

tests:
  file_globs:
    - "**/*.test.tsx"
    - "**/*.test.ts"
    - "**/*.spec.tsx"
    - "**/*.spec.ts"
    - "**/__tests__/**/*.{ts,tsx}"
    - "**/cypress/**/*.cy.{ts,tsx}"
    - "**/tests/e2e/**/*.{ts,tsx}"
```

## extract.py — key functions

### `resolve_routes()`

**React Router v6 (JSX declarative)**:
```tsx
<Routes>
  <Route path="orders" element={<OrdersPage />}>
    <Route path=":id" element={<OrderDetailPage />} />
    <Route path="new" element={<NewOrderPage />} />
  </Route>
</Routes>
```
- Nested Routes → path concatenation through parent-child chain
- `element` prop's JSX component = handler
- `loader` prop reference = pre-fetch function (extract as related hook)
- Layout routes (no path, just element) → inherit parent path

**React Router v6 (object config)**:
```tsx
const router = createBrowserRouter([
  { path: "/orders", element: <OrdersPage />, children: [...] }
]);
```
- Walk array + children recursively
- Same path concatenation rules

**Next.js App Router** (`app/` directory):
- Filesystem routing. `app/orders/page.tsx` → route `/orders`
- `app/orders/[id]/page.tsx` → `/orders/[id]`
- `app/(marketing)/about/page.tsx` → `/about` (route group parentheses excluded)
- `layout.tsx`, `loading.tsx`, `error.tsx` tracked as meta-routes
- `route.ts` files (API routes) → backend-style routes with HTTP methods exported as named functions (GET, POST)

**Next.js Pages Router** (`pages/` directory):
- `pages/orders/index.tsx` → `/orders`
- `pages/orders/[id].tsx` → `/orders/:id`
- `pages/api/**/*.ts` → API endpoints (backend-style)

**TanStack Router** (file-based):
- `routes/__root.tsx`, `routes/orders/index.tsx` → similar convention to Next
- Type-safe but adapter extracts from filesystem structure + `createRoute` calls

### Normalized route entry

For each FE route:
```yaml
- id: R-N
  service_id: web
  method: GET                 # SPA routes are always GET conceptually
  path: /orders/:id
  handler_symbol: OrderDetailPage
  handler_file: src/pages/orders/[id].tsx
  auth_scope: [policy:AuthGuard | route:authenticated]  # derived from wrapper / middleware
  entities_touched: [Order]  # inferred from useQuery/useFetch hook type params
  adapter: react
  confidence: 0.9
```

For Next.js API routes (`app/*/route.ts` or `pages/api/*.ts`):
```yaml
- method: GET | POST | ...    # from exported function name or handler
  path: /api/orders/:id
  handler_symbol: handlers.GET  # exported name
  adapter: react
  kind: backend-in-frontend     # special marker — these are true API endpoints
```

### `resolve_components(component_matches)`

For each component:
- Classify: **page component** (in `pages/`, `app/`, or referenced by `element=` in Route) vs **shared component** (primitives, layouts) vs **HOC / provider**
- Extract `Props` interface (TS) or `propTypes` (JS) → input contract
- Extract child component imports → component tree
- Hooks used → behavioral signals

### Entity inference for FE

FE rarely has entities natively. Infer from:
1. Typed fetch hooks:
   ```tsx
   const { data } = useQuery<Order[]>(['orders'], fetchOrders);
   const mutation = useMutation<Order, Error, CreatePayload>(createOrder);
   ```
   → `entities_touched: [Order]`
2. GraphQL codegen types (if `@graphql-codegen/*` in deps and generated types committed)
3. OpenAPI-generated clients (if `openapi-typescript` or similar) — parse generated `paths.ts` for endpoints + types
4. Explicit entity types: `import { Order } from '@/types'` or `from '@shared/types'`

If BE adapter (nestjs / fastapi / dotnet / etc.) also present in same workspace, P1.5 merger correlates entity names → confirms cross-service feature clustering.

### `normalize_auth_scope()`

FE auth varies widely. Patterns:
- Route wrapper component: `<ProtectedRoute><OrdersPage /></ProtectedRoute>` → `authenticated`
- Role wrapper: `<AdminOnly><AdminPanel /></AdminOnly>` → `role:admin`
- Next.js middleware (`middleware.ts`) matching route patterns → apply middleware result to matched routes
- `useAuth()` hook guarding render → introspect conditional render logic
- Conditional routes: if route is inside a block like `{user?.role === 'admin' && <AdminRoutes />}` → `role:admin`

### `extract_di_graph()`

FE "DI" = props + context + hooks. Adapter reports:
- Context providers and consumers: `{from: ConsumerComp, to: ProviderComp, kind: context}`
- Custom hook dependency: `{from: Component, to: useOrders, kind: hook}`
- Child component tree: `{from: Parent, to: Child, kind: direct-import}` (renders Child)

### `extract_integrations()`

- Backend API calls: `fetch`, `axios`, `ky`, `ofetch`, custom wrapper
- Realtime: `socket.io-client`, native WebSocket, `@tanstack/react-query`'s WebSocket hooks
- Storage: `@aws-sdk/client-s3` (client-side uploads), presigned URL patterns
- Auth provider: NextAuth, Clerk, Auth0 SDK, Firebase Auth — mark kind=auth-provider
- Analytics: GA, Segment, Mixpanel — kind=storage (event ingestion) for data-flow completeness

### `extract_feature_flags()`

- LaunchDarkly React SDK (`useFlag`)
- Unleash proxy + React client
- Convention: `NEXT_PUBLIC_FEATURE_X` / `VITE_FEATURE_X` env flags
- In-app toggle: custom `useFeature('X')` hook pattern

### `extract_i18n()`

- **next-i18next** / **next-intl**: `public/locales/{lang}/{namespace}.json`
- **react-i18next**: `src/locales/{lang}/translation.json` (or per-namespace files)
- **Lingui**: `.po` files under `src/locales/`
- **FormatJS** (`react-intl`): JSON message descriptors with id + defaultMessage
- Parse all → namespaces map; preserve VN translations verbatim

### Server Components (Next.js App Router)

Next.js 13+ App Router splits components:
- Server Components (default) — no hooks, can do DB queries directly
- Client Components (`'use client';` at top)

Adapter flags each page/layout with `runtime: server | client`. Server components directly calling DB (e.g. drizzle/prisma) → also contribute entity signals.

## Testing

- Unit/component: Jest + React Testing Library, Vitest + RTL
  - `describe('OrderList', () => { it('renders items', ...) })` → preserve describe text
- E2E: Cypress, Playwright
  - Test files under `cypress/e2e/` or `e2e/` or `tests/e2e/`

## Limitations (v1)

- Storybook stories not counted as tests (could inform screen inventory though)
- React Server Functions / Actions (Next.js) partially supported (detected as backend-in-frontend)
- CSS-in-JS / CSS Modules not relevant to feature extraction (ignored)
- MDX-based routes (Docusaurus, Nextra) not parsed
- Micro-frontend shells (Module Federation) not specially handled

## Known stacks tested

| Stack | Notes |
|---|---|
| Vite + React Router v6 + TypeScript | Full support |
| Next.js 14 App Router + TypeScript | Full (incl. server components + route.ts) |
| Next.js 13 Pages Router | Full |
| CRA + React Router v6 | Full |
| TanStack Router (file-based) | Full |
| Remix | Partial (routing + loader extract; actions partial) |
