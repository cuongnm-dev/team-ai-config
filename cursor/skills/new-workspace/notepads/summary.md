# Phase 9 — Summary Card

Loaded on demand by `new-workspace/SKILL.md` Phase 9.

---

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ {project-name} is ready!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  stack: {stack} | Repo: {mini|mono} | Prefix: {PREFIX} | PM: {pm}

  Start (services first):
    docker compose up -d          ← starts db, cache, app
    {exact dev command}           ← hot-reload on local code

  [only if database selected and ORM ≠ none]
  DB migrate: {pnpm db:push | uv run alembic upgrade head | go run ./cmd/migrate}

  [only if auth selected and needs env vars]
  auth: Fill {VAR_NAME} in .env  (all other vars have dev defaults)

  Test / Lint / Build:
    {test cmd} → {lint cmd} → {build cmd}

  docs:  {docs_path per .cursor/AGENTS.md} | ADRs: docs/architecture/adr/

  {teaching line — see below}

  next: /new-feature
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Teaching lines (one per stack — include in summary):**
- Next.js: `Server Components fetch data. 'use client' only for interactivity.`
- NestJS: `Controller → Service → Repository. Never skip a layer.`
- FastAPI: `Pydantic validates at the boundary. SQLAlchemy stays in repositories.`
- Go: `Return errors, don't panic. Handlers are just functions with Context.`
- Rust: `The compiler prevents data races. Trust it, don't fight it.`
- React SPA: `Colocate state with the component that owns it. Lift only when forced.`
- Vue/Nuxt: `composables/ is your hooks equivalent. Keep templates declarative.`
- React Native: `Platform.OS for divergence. StyleSheet.create for performance.`
- Flutter: `Widgets are immutable. State lives in State objects or providers.`
- Monorepo: `Run any command twice — the second run hits the cache.`
