# Phase 0 — Auto-detect repo name

Loaded on demand by `zip-disk/SKILL.md` Phase 0.

Priority order (stop on first hit):

| # | Source | Extract |
|---|---|---|
| 1 | `git config --get remote.origin.url` | `basename $URL .git` |
| 2 | `git rev-parse --show-toplevel` | `basename $RESULT` |
| 3 | `package.json` → `.name` | strip `@scope/` prefix |
| 4 | `nx.json` → `.npmScope` | — |
| 5 | `pyproject.toml` → `[project].name` | — |
| 6 | `go.mod` line 1 | last path segment |
| 7 | `Cargo.toml` → `[package].name` | — |
| 8 | `basename $(pwd)` | fallback |

slugify: lowercase, replace non-alphanumeric with `-`, collapse multi-hyphens, strip leading/trailing hyphens.

```bash
detect_repo_name() {
  local name=""
  name=$(git config --get remote.origin.url 2>/dev/null | sed 's/\.git$//' | xargs -I{} basename {})
  [ -z "$name" ] && name=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
  [ -z "$name" ] && [ -f package.json ] && \
    name=$(node -p "require('./package.json').name" 2>/dev/null | sed 's/@[^/]*\///')
  [ -z "$name" ] && [ -f nx.json ] && name=$(node -p "require('./nx.json').npmScope" 2>/dev/null)
  [ -z "$name" ] && [ -f pyproject.toml ] && name=$(grep -oP '^name\s*=\s*"\K[^"]+' pyproject.toml 2>/dev/null | head -1)
  [ -z "$name" ] && [ -f go.mod ] && name=$(basename "$(grep -oP '^module\s+\K\S+' go.mod | head -1)")
  [ -z "$name" ] && [ -f Cargo.toml ] && name=$(grep -A10 '^\[package\]' Cargo.toml | grep -oP '^name\s*=\s*"\K[^"]+' | head -1)
  [ -z "$name" ] && name=$(basename "$(pwd)")
  echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g'
}

REPO_SLUG=$(detect_repo_name)
TODAY=$(date +%Y%m%d)
ZIP_NAME="${REPO_SLUG}-ban-giao-${TODAY}.zip"
```

Show detected name, ask 1 line confirm:
```
📦 Repo: {REPO_SLUG} → ZIP: {ZIP_NAME}
Xác nhận (yes) hoặc nhập tên khác:
```
