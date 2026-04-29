# PM Ref: MCP × Agent Mapping

> **Load on demand only** — read this file ONLY when `available_mcps` in `_state.md` is non-empty.
> If `ListMcpResources` returns empty, skip entirely.

---

## MCP × Agent Mapping Table

Pass only MCPs relevant to the current agent invocation. Never load all MCPs at once.

| MCP                 | Recommended server                                      | Agents                                               | What to fetch                                                                                          |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| GitHub              | `github` (official)                                     | `reviewer`, `dev`, `devops`, `release-manager`, `qa` | PR diff + CI status before reviewer; branch status before dev; release tags before release-manager     |
| GitLab              | `gitlab` (official)                                     | `reviewer`, `dev`, `devops`                          | MR diff, pipeline status, job logs                                                                     |
| Context7            | `context7` (Upstash)                                    | `dev`, `fe-dev`, `sa`, `tech-lead`                   | Library docs for any new dependency in tech-lead plan — call `resolve-library-id` + `get-library-docs` |
| NX                  | `nx-mcp` (Nrwl)                                         | `tech-lead`, `dev`, `devops`                         | `get_project_graph`, `get_affected_projects` before tech-lead planning                                 |
| Database (Postgres) | `postgres-mcp` or `crystaldba/postgres-mcp`             | `sa`, `dev`, `data-governance`                       | Query target tables only — never dump full schema                                                      |
| Linear              | `linear` (official)                                     | `pm`, `ba`                                           | Sprint tickets, ACs, linked issues                                                                     |
| Jira+Confluence     | `atlassian-mcp` (official) or `sooperset/mcp-atlassian` | `pm`, `ba`, `sa`                                     | JQL query for relevant issues; Confluence pages for existing specs                                     |
| Playwright          | `playwright` (Microsoft)                                | `qa`                                                 | Accessibility tree snapshots — use snapshot mode, not screenshot mode                                  |
| Semgrep             | `semgrep` (via binary)                                  | `security`, `reviewer`                               | SAST scan of changed files before security verdict                                                     |
| Sentry              | `sentry` (official)                                     | `sre-observability`, `devops`, `qa`                  | Recent errors in affected service before QA and SRE review                                             |
| New Relic           | `newrelic` (official)                                   | `sre-observability`                                  | Latency/error rate baseline before SRE assessment                                                      |
| ArgoCD              | `mcp-for-argocd` (argoproj-labs)                        | `devops`, `release-manager`                          | App sync status, rollback targets                                                                      |
| Atlan               | `atlan` (official)                                      | `data-governance`, `sa`                              | Data lineage, PII columns, ownership — replaces reading data dictionaries                              |

## Per-Stage Fetch Guide (lazy — just before agent invocation)

| Stage                      | Fetch via MCP                                    |
| -------------------------- | ------------------------------------------------ |
| Before `sa`                | DB schema (target tables only) + API docs        |
| Before `tech-lead`         | NX project graph for affected scope              |
| Before `dev`/`fe-dev`      | Context7 docs for new libraries                  |
| Before `reviewer`          | GitHub/GitLab PR diff + CI status + Semgrep scan |
| Before `qa`                | Playwright availability + Sentry recent errors   |
| Before `sre-observability` | New Relic/Sentry baselines                       |
| Before `release-manager`   | ArgoCD sync status                               |
