#!/usr/bin/env bash
# extract_code_facts.sh — Phase 1B deterministic fact extractor
#
# Usage: ./extract_code_facts.sh <project-root> <output-path>
# Output: {output-path}/code-facts.json
#
# NO LLM, pure bash/jq/yq/grep. Runs in 2-5 seconds.

set -e

PROJECT_ROOT="${1:-.}"
OUTPUT_PATH="${2:-intel/code-facts.json}"

cd "$PROJECT_ROOT"

# Helper: safe jq from file
_jq() { jq -r "$1" 2>/dev/null || echo "null"; }

# Init output structure
TMP=$(mktemp -d)
echo '{"meta":{},"tech_stack":[],"docker":{},"routes":[],"entities":[],"validation_constraints":[],"env_vars":[],"ci_cd":{},"infrastructure":{}}' > "$TMP/facts.json"

# === 1. Tech stack ===
if [ -f package.json ]; then
  jq -c '.dependencies // {} | to_entries[] |
    {layer: "backend", name: .key, version: (.value | sub("^[\\^~]"; "")), source: "package.json"}' \
    package.json >> "$TMP/deps.jsonl" 2>/dev/null || true
  jq -c '.devDependencies // {} | to_entries[] |
    {layer: "dev", name: .key, version: (.value | sub("^[\\^~]"; "")), source: "package.json"}' \
    package.json >> "$TMP/deps.jsonl" 2>/dev/null || true
fi

if [ -f pyproject.toml ]; then
  grep -E '^[a-zA-Z0-9_-]+\s*=\s*"' pyproject.toml | \
    sed -E 's/^([a-zA-Z0-9_-]+)\s*=\s*"([^"]+)".*/{"layer":"backend","name":"\1","version":"\2","source":"pyproject.toml"}/' \
    >> "$TMP/deps.jsonl" 2>/dev/null || true
fi

if [ -f go.mod ]; then
  grep -E '^\s+[a-zA-Z]' go.mod | awk '{print "{\"layer\":\"backend\",\"name\":\""$1"\",\"version\":\""$2"\",\"source\":\"go.mod\"}"}' \
    >> "$TMP/deps.jsonl" 2>/dev/null || true
fi

# === 2. Docker services ===
COMPOSE_FILE=""
for f in docker-compose.yml docker-compose.yaml compose.yml compose.yaml; do
  [ -f "$f" ] && COMPOSE_FILE="$f" && break
done

if [ -n "$COMPOSE_FILE" ] && command -v yq &>/dev/null; then
  yq -o=json '.services' "$COMPOSE_FILE" > "$TMP/services.json" 2>/dev/null || echo '{}' > "$TMP/services.json"
fi

# === 3. Routes (best-effort heuristic) ===

# NestJS / TypeScript
grep -rnE "@(Get|Post|Put|Delete|Patch)\(['\"]" src/ 2>/dev/null --include="*.ts" | head -200 | \
  sed -E "s|([^:]+):([0-9]+):.*@(Get|Post|Put|Delete|Patch)\(['\"]([^'\"]+)['\"].*|{\"method\":\"\U\3\",\"path\":\"\4\",\"file\":\"\1\",\"line\":\2}|" \
  > "$TMP/routes.jsonl" 2>/dev/null || true

# FastAPI
grep -rnE "@(app|router)\.(get|post|put|delete|patch)\(['\"]" --include="*.py" 2>/dev/null | head -200 | \
  sed -E 's|([^:]+):([0-9]+):.*\.(get|post|put|delete|patch)\(['"'"'"]([^'"'"'"]+)['"'"'"].*|{"method":"\U\3","path":"\4","file":"\1","line":\2}|' \
  >> "$TMP/routes.jsonl" 2>/dev/null || true

# Spring
grep -rnE "@(Get|Post|Put|Delete)Mapping\(['\"]" --include="*.java" 2>/dev/null | head -200 | \
  sed -E "s|([^:]+):([0-9]+):.*@(Get|Post|Put|Delete)Mapping\(['\"]([^'\"]+)['\"].*|{\"method\":\"\U\3\",\"path\":\"\4\",\"file\":\"\1\",\"line\":\2}|" \
  >> "$TMP/routes.jsonl" 2>/dev/null || true

# === 4. Entities ===

# Prisma
if [ -f prisma/schema.prisma ]; then
  grep -nE "^model\s+\w+" prisma/schema.prisma | \
    sed -E 's|([0-9]+):model\s+(\w+).*|{"name":"\2","file":"prisma/schema.prisma","line":\1}|' \
    > "$TMP/entities.jsonl"
fi

# TypeORM
grep -rnE "^\s*@Entity\(" src/ --include="*.ts" 2>/dev/null | head -100 | \
  awk -F: '{name=""; cmd="grep -A1 @Entity " $1 " | grep -oE \"class\\s+[A-Z]\\w+\""; cmd | getline name; close(cmd);
           if (name != "") { gsub("class ", "", name); print "{\"name\":\""name"\",\"file\":\""$1"\",\"line\":"$2"}" }}' \
  >> "$TMP/entities.jsonl" 2>/dev/null || true

# === 5. Validation constraints ===
grep -rnE "@(IsNotEmpty|IsEmail|Min|Max|Length|MinLength|MaxLength|Matches|IsIn|IsUUID|IsOptional)\(" \
  src/ --include="*.ts" 2>/dev/null | head -200 | \
  sed -E 's|([^:]+):([0-9]+):\s*(.*)@(\w+)\(([^)]*)\).*|{"file":"\1","line":\2,"decorator":"\4","args":"\5"}|' \
  > "$TMP/validations.jsonl" 2>/dev/null || true

# Bean Validation
grep -rnE "@(NotNull|NotBlank|Min|Max|Size|Pattern|Email)\(" \
  --include="*.java" 2>/dev/null | head -200 | \
  sed -E 's|([^:]+):([0-9]+):\s*(.*)@(\w+)\(([^)]*)\).*|{"file":"\1","line":\2,"decorator":"\4","args":"\5"}|' \
  >> "$TMP/validations.jsonl" 2>/dev/null || true

# Pydantic
grep -rnE "Field\(\s*[^)]*(min_length|max_length|gt|lt|ge|le|pattern|regex)" \
  --include="*.py" 2>/dev/null | head -200 >> "$TMP/validations.jsonl" 2>/dev/null || true

# === 6. Env vars ===
for f in .env .env.example .env.template; do
  [ -f "$f" ] && grep -E "^[A-Z_][A-Z0-9_]*=" "$f" | cut -d= -f1 | \
    awk -v src="$f" '{print "{\"name\":\""$0"\",\"source\":\""src"\",\"required\":true}"}' \
    >> "$TMP/env.jsonl"
done

# === 7. CI/CD ===
CI_PLATFORM="none"
CI_WORKFLOWS=0
[ -d .github/workflows ] && CI_PLATFORM="github-actions" && CI_WORKFLOWS=$(ls .github/workflows/*.yml 2>/dev/null | wc -l)
[ -f .gitlab-ci.yml ] && CI_PLATFORM="gitlab-ci" && CI_WORKFLOWS=1
[ -f Jenkinsfile ] && CI_PLATFORM="jenkins" && CI_WORKFLOWS=1

HAS_TESTS=false
grep -qr -E '(jest|vitest|pytest|go test|mvn test)' .github/workflows/ 2>/dev/null && HAS_TESTS=true
HAS_LINT=false
grep -qr -E '(eslint|ruff|black|golangci-lint)' .github/workflows/ 2>/dev/null && HAS_LINT=true

# === 8. Infrastructure ===
LOGGER="unknown"
grep -qr "import.*pino" src/ 2>/dev/null && LOGGER="pino"
grep -qr "import.*winston" src/ 2>/dev/null && LOGGER="winston"
grep -qr "import.*zap" . --include="*.go" 2>/dev/null && LOGGER="zap"
grep -qr "import.*logrus" . --include="*.go" 2>/dev/null && LOGGER="logrus"
grep -qr "logger = logging.getLogger" --include="*.py" 2>/dev/null && LOGGER="python-logging"

HAS_METRICS=false
grep -qr "prometheus" . --include="*.yml" --include="*.ts" --include="*.py" --include="*.go" 2>/dev/null && HAS_METRICS=true

HEALTH_ENDPOINT=""
grep -qrE "['\"]\/health['\"]" src/ 2>/dev/null && HEALTH_ENDPOINT="/health"
grep -qrE "['\"]\/healthz['\"]" src/ 2>/dev/null && HEALTH_ENDPOINT="/healthz"

# === Assemble final JSON ===
python3 - <<PYEOF
import json, os, sys
from datetime import datetime, timezone

TMP = "$TMP"

def load_jsonl(path):
    if not os.path.exists(path): return []
    lines = []
    with open(path, encoding='utf-8', errors='ignore') as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try:
                lines.append(json.loads(line))
            except: pass
    return lines

out = {
    "meta": {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "extractor_version": "1B-v1",
        "project_root": "$PROJECT_ROOT"
    },
    "tech_stack": load_jsonl(f"{TMP}/deps.jsonl"),
    "docker": json.load(open(f"{TMP}/services.json")) if os.path.exists(f"{TMP}/services.json") else {},
    "routes": load_jsonl(f"{TMP}/routes.jsonl"),
    "entities": load_jsonl(f"{TMP}/entities.jsonl"),
    "validation_constraints": load_jsonl(f"{TMP}/validations.jsonl"),
    "env_vars": load_jsonl(f"{TMP}/env.jsonl"),
    "ci_cd": {
        "platform": "$CI_PLATFORM",
        "workflows_count": $CI_WORKFLOWS,
        "has_tests": $HAS_TESTS,
        "has_lint": $HAS_LINT
    },
    "infrastructure": {
        "logger": "$LOGGER",
        "has_metrics": $HAS_METRICS,
        "healthcheck_endpoint": "$HEALTH_ENDPOINT"
    },
    "summary": {
        "total_dependencies": 0,
        "total_routes": 0,
        "total_entities": 0,
        "total_validations": 0
    }
}

out["summary"]["total_dependencies"] = len(out["tech_stack"])
out["summary"]["total_routes"] = len(out["routes"])
out["summary"]["total_entities"] = len(out["entities"])
out["summary"]["total_validations"] = len(out["validation_constraints"])

os.makedirs(os.path.dirname("$OUTPUT_PATH") or ".", exist_ok=True)
with open("$OUTPUT_PATH", "w", encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print(f"✅ code-facts.json written: {out['summary']}")
PYEOF

# Cleanup
rm -rf "$TMP"
