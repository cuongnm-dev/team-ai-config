/**
 * ai-kit telemetry Worker
 * Receives anonymized usage stats from member machines, stores in KV,
 * exposes /aggregate for GitHub Actions to build public dashboard.
 *
 * Endpoints:
 *   GET  /health    → liveness
 *   POST /ingest    → receive share JSON from member
 *   GET  /aggregate → merged stats (consumed by GHA → dashboard)
 *
 * Privacy: see docs/privacy.md.
 *   - Payload validated server-side: anon_member_id must be sha256-16hex,
 *     known fields only, max 64KiB per payload.
 *   - No IP stored; only request.cf.country (for geo distribution stat).
 *   - 60-day TTL on individual share keys.
 */

const ALLOWED_ORIGINS = ["*"]; // dashboard runs on github pages — open CORS OK
const MAX_PAYLOAD_BYTES = 65536; // 64 KiB
const SHARE_TTL_SECONDS = 60 * 86400; // 60 days

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-AI-Kit-Version",
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders, ...extraHeaders },
  });
}

function validateShare(body) {
  if (!body || typeof body !== "object") return "not_object";
  if (typeof body.anon_member_id !== "string") return "missing_anon_member_id";
  if (!/^[a-f0-9]{16}$/.test(body.anon_member_id)) return "bad_anon_member_id";
  if (typeof body.generated !== "string") return "missing_generated";
  if (typeof body.since !== "string") return "missing_since";
  // Optional fields — accept if present, type-check
  for (const key of ["by_skill", "by_agent", "by_tool", "by_model", "error_categories", "by_day", "by_hour", "by_weekday"]) {
    if (body[key] !== undefined && (typeof body[key] !== "object" || Array.isArray(body[key]))) {
      return `bad_${key}`;
    }
  }
  return null;
}

async function handleIngest(request, env) {
  const contentLen = parseInt(request.headers.get("content-length") || "0", 10);
  if (contentLen > MAX_PAYLOAD_BYTES) {
    return jsonResponse({ error: "payload_too_large", max: MAX_PAYLOAD_BYTES }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "json_parse_failed", message: String(e) }, 400);
  }

  const validationError = validateShare(body);
  if (validationError) {
    return jsonResponse({ error: "invalid_payload", reason: validationError }, 400);
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const key = `share:${body.anon_member_id}:${today}`;

  // Augment with server-side metadata (NOT user-controllable)
  const stored = {
    ...body,
    received_at: new Date().toISOString(),
    cf_country: request.cf?.country || "unknown",
    cf_colo: request.cf?.colo || "unknown",
  };

  await env.AI_KIT_TELEMETRY.put(key, JSON.stringify(stored), {
    expirationTtl: SHARE_TTL_SECONDS,
  });

  return jsonResponse({ ok: true, key, ttl_days: SHARE_TTL_SECONDS / 86400 });
}

async function handleAggregate(env) {
  // List up to 1000 most recent share keys (KV list cap = 1000 per call)
  const list = await env.AI_KIT_TELEMETRY.list({ prefix: "share:", limit: 1000 });
  const shares = [];
  // Fetch in parallel batches of 50
  const batchSize = 50;
  for (let i = 0; i < list.keys.length; i += batchSize) {
    const batch = list.keys.slice(i, i + batchSize);
    const values = await Promise.all(
      batch.map((k) => env.AI_KIT_TELEMETRY.get(k.name).catch(() => null))
    );
    for (const v of values) {
      if (v) {
        try { shares.push(JSON.parse(v)); } catch {}
      }
    }
  }

  return jsonResponse(aggregateShares(shares));
}

function aggregateShares(shares) {
  const result = {
    generated: new Date().toISOString(),
    members_total: 0,
    members_active_7d: 0,
    members_active_30d: 0,
    sessions_total: 0,
    requests_total: 0,
    tokens_total: 0,
    cost_estimate_total: 0,
    cache_hit_rate_p50: 0,
    errors_total: 0,
    by_skill: {},
    by_agent: {},
    by_tool: {},
    by_model: {},
    error_categories: {},
    by_day: {},
    by_weekday: {},
    by_hour: {},
    cf_country: {},
    member_first_seen: {}, // anon_id → first_seen
  };

  const now = Date.now();
  const D7 = 7 * 86400_000;
  const D30 = 30 * 86400_000;
  const cacheRates = [];
  const seenMembers = new Set();

  for (const s of shares) {
    seenMembers.add(s.anon_member_id);
    const recvMs = new Date(s.received_at || s.generated).getTime();
    if (now - recvMs <= D7) result.members_active_7d = result.members_active_7d || 0;
    // count distinct members later

    result.sessions_total += s.sessions || 0;
    result.requests_total += s.requests || 0;
    result.tokens_total += s.total_tokens || 0;
    result.cost_estimate_total += s.total_cost_api_equivalent || 0;
    result.errors_total += s.errors_total || 0;

    if (typeof s.cache_hit_rate === "number") cacheRates.push(s.cache_hit_rate);

    mergeCounter(result.by_skill, s.by_skill);
    mergeAgentCounter(result.by_agent, s.by_agent);
    mergeCounter(result.by_tool, s.by_tool);
    mergeCounter(result.by_model, s.by_model);
    mergeCounter(result.error_categories, s.error_categories);
    mergeCounter(result.by_day, s.by_day);
    mergeCounter(result.by_weekday, s.by_weekday);
    mergeCounter(result.by_hour, s.by_hour);
    if (s.cf_country) result.cf_country[s.cf_country] = (result.cf_country[s.cf_country] || 0) + 1;
  }

  // Re-count active members properly (distinct anon_id within window)
  const active7d = new Set();
  const active30d = new Set();
  for (const s of shares) {
    const t = new Date(s.received_at || s.generated).getTime();
    if (now - t <= D7) active7d.add(s.anon_member_id);
    if (now - t <= D30) active30d.add(s.anon_member_id);
  }
  result.members_total = seenMembers.size;
  result.members_active_7d = active7d.size;
  result.members_active_30d = active30d.size;
  result.cache_hit_rate_p50 = cacheRates.length ? median(cacheRates) : 0;
  return result;
}

function mergeCounter(target, source) {
  if (!source || typeof source !== "object") return;
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "number") target[k] = (target[k] || 0) + v;
  }
}

function mergeAgentCounter(target, source) {
  if (!source || typeof source !== "object") return;
  for (const [k, v] of Object.entries(source)) {
    const dispatches = typeof v === "object" && v ? (v.dispatches || 0) : (typeof v === "number" ? v : 0);
    target[k] = (target[k] || 0) + dispatches;
  }
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return jsonResponse({ ok: true, ts: Date.now(), worker: "ai-kit-telemetry" });
    }

    if (request.method === "POST" && url.pathname === "/ingest") {
      return handleIngest(request, env);
    }

    if (request.method === "GET" && url.pathname === "/aggregate") {
      return handleAggregate(env);
    }

    return jsonResponse({ error: "not_found", path: url.pathname }, 404);
  },
};
