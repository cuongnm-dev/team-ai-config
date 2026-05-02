# Reference tables — File Load Map + Stack ID Mapping

Loaded on demand. Both tables are needed during Phase 6 scaffold; the dispatcher passes the resolved `stack-id` into `notepads/scaffold.md`.

---

## File Load Map — Read ONLY when reaching that step

| Step | File | Condition |
|---|---|---|
| Phase 6 Step 2 | `ref-stack-{stack-id}.md` | always — contains dir tree, starter code, conventions, .env, .gitignore |
| Phase 6 Step 3 | `ref-workspace.md` | always — .cursor/AGENTS.md + project-knowledge templates |
| Phase 6 Step 12 | `ref-docs.md` | always — ADR-001/002, CLAUDE.md, CONTRIBUTING.md |
| Phase 7 | `ref-checklist.md` | always — scaffold checklist + verification commands |
| Phase 6 Step 5 | `ref-auth.md` | only if auth ≠ none |
| Phase 6 Step 7 | `ref-docker.md` | always — Docker is always enabled |
| Phase 6 Step 8 | `ref-ci.md` | only if CI ≠ skip |
| Phase 6 Step 9 | `ref-tooling.md` | only if Node.js stack |

## Stack ID mapping

| User choice | stack-id |
|---|---|
| React SPA (Vite) | `react-spa` |
| Next.js | `nextjs` |
| Vue / Nuxt | `vue` |
| SvelteKit | `svelte` |
| NestJS | `nestjs` |
| Node.js (Fastify/Express) | `node-api` |
| Python FastAPI | `fastapi` |
| Go | `go` |
| Rust (Axum) | `rust` |
| .NET | `dotnet` |
| React Native | `react-native` |
| Flutter | `flutter` |
| Monorepo | `mono` |
