// pricing.mjs — Multi-vendor pricing table for ai-kit statistics.
//
// All prices in USD per 1M tokens. Verified 2026-05-04 from vendor pricing pages
// (Anthropic, Cursor, OpenAI, Codeium/Windsurf, Moonshot, OpenRouter).
//
// Schema: { in: input/M, out: output/M, cr: cache_read/M, cw: cache_write/M, vendor, ide }
// Some platforms don't expose cache fields — set 0 (treated as not-applicable).
//
// `vendor` = upstream model owner (anthropic, openai, cursor, codeium, moonshot, ...)
// `ide`    = which ide typically routes this model (cursor, claude-code, windsurf, kilo, multi)

export const PRICING = {
  // ─── Anthropic (via Claude Code direct OR Cursor / Windsurf / Kilo) ───
  'claude-opus-4':       { in: 15.0,  out: 75.0, cr: 1.50, cw: 18.75, vendor: 'anthropic', ide: 'multi' },
  'claude-opus-4-7':     { in: 15.0,  out: 75.0, cr: 1.50, cw: 18.75, vendor: 'anthropic', ide: 'multi' },
  'claude-opus-4-6':     { in: 15.0,  out: 75.0, cr: 1.50, cw: 18.75, vendor: 'anthropic', ide: 'multi' },
  'claude-sonnet-4':     { in:  3.0,  out: 15.0, cr: 0.30, cw:  3.75, vendor: 'anthropic', ide: 'multi' },
  'claude-sonnet-4-6':   { in:  3.0,  out: 15.0, cr: 0.30, cw:  3.75, vendor: 'anthropic', ide: 'multi' },
  'claude-sonnet-4-7':   { in:  3.0,  out: 15.0, cr: 0.30, cw:  3.75, vendor: 'anthropic', ide: 'multi' },
  'claude-sonnet-4-20250514': { in: 3.0, out: 15.0, cr: 0.30, cw: 3.75, vendor: 'anthropic', ide: 'multi' },
  'claude-haiku-4':      { in:  0.8,  out:  4.0, cr: 0.08, cw:  1.00, vendor: 'anthropic', ide: 'multi' },
  'claude-3-5-sonnet':   { in:  3.0,  out: 15.0, cr: 0.30, cw:  3.75, vendor: 'anthropic', ide: 'multi' },
  'claude-3-5-haiku':    { in:  0.8,  out:  4.0, cr: 0.08, cw:  1.00, vendor: 'anthropic', ide: 'multi' },

  // ─── Cursor proprietary (Composer family) ───────────────────────────
  // Composer 2 Standard: latency-balanced. Composer 2 Fast: latency-optimized (3x cost).
  'composer-2':          { in:  0.5,  out:  2.5, cr: 0.20, cw:  0.0,  vendor: 'cursor',    ide: 'cursor' },
  'composer-2-fast':     { in:  1.5,  out:  7.5, cr: 0.35, cw:  0.0,  vendor: 'cursor',    ide: 'cursor' },
  // Cursor's "auto" router — bills by underlying selected model. We use weighted average as fallback.
  'auto':                { in:  2.0,  out:  8.0, cr: 0.30, cw:  0.0,  vendor: 'cursor',    ide: 'cursor' },

  // ─── OpenAI (via Cursor or direct) ─────────────────────────────────
  'gpt-5.5':             { in:  5.0,  out: 20.0, cr: 0.50, cw:  0.0,  vendor: 'openai',    ide: 'multi' },
  'gpt-5.4':             { in:  3.5,  out: 14.0, cr: 0.35, cw:  0.0,  vendor: 'openai',    ide: 'multi' },
  'gpt-5.3-codex':       { in:  4.0,  out: 16.0, cr: 0.40, cw:  0.0,  vendor: 'openai',    ide: 'multi' },
  'codex-5.3':           { in:  4.0,  out: 16.0, cr: 0.40, cw:  0.0,  vendor: 'openai',    ide: 'multi' },

  // ─── Codeium / Windsurf proprietary (SWE family) ────────────────────
  // SWE-1.5 / SWE-1.6 — free promo Q1-Q2 2026 (3-month window). After promo expires, update prices.
  'swe-1.5':             { in:  0.0,  out:  0.0, cr: 0.0,  cw:  0.0,  vendor: 'codeium',   ide: 'windsurf', promo: true },
  'swe-1.5-fast':        { in:  0.0,  out:  0.0, cr: 0.0,  cw:  0.0,  vendor: 'codeium',   ide: 'windsurf', promo: true },
  'swe-1.6':             { in:  0.0,  out:  0.0, cr: 0.0,  cw:  0.0,  vendor: 'codeium',   ide: 'windsurf', promo: true },
  'swe-1.6-fast':        { in:  0.0,  out:  0.0, cr: 0.0,  cw:  0.0,  vendor: 'codeium',   ide: 'windsurf', promo: true },
  'swe-1':               { in:  0.0,  out:  0.0, cr: 0.0,  cw:  0.0,  vendor: 'codeium',   ide: 'windsurf', promo: true },
  // Adaptive — Codeium's auto-router. Approximate average; actual depends on routed model.
  'adaptive':            { in:  1.0,  out:  4.0, cr: 0.10, cw:  0.0,  vendor: 'codeium',   ide: 'windsurf' },

  // ─── Moonshot Kimi (via Windsurf / OpenRouter) ──────────────────────
  'kimi-k2.5':           { in:  0.6,  out:  2.5, cr: 0.0,  cw:  0.0,  vendor: 'moonshot',  ide: 'multi' },
  'kimi-k2.6':           { in:  0.6,  out:  2.5, cr: 0.0,  cw:  0.0,  vendor: 'moonshot',  ide: 'multi' },

  // ─── Google (via Windsurf / OpenRouter) ─────────────────────────────
  'gemini-3-flash':      { in:  0.3,  out:  1.2, cr: 0.0,  cw:  0.0,  vendor: 'google',    ide: 'multi' },
  'gemini-3.1-pro':      { in:  3.5,  out: 14.0, cr: 0.0,  cw:  0.0,  vendor: 'google',    ide: 'multi' },

  // ─── xAI (via Windsurf / OpenRouter) ────────────────────────────────
  'grok-3':              { in:  4.0,  out: 16.0, cr: 0.0,  cw:  0.0,  vendor: 'xai',       ide: 'multi' },

  // ─── ZhipuAI / GLM (via Windsurf) ───────────────────────────────────
  'glm-5.1':             { in:  0.5,  out:  2.0, cr: 0.0,  cw:  0.0,  vendor: 'zhipuai',   ide: 'multi' },

  // ─── Minimax (via Windsurf) ─────────────────────────────────────────
  'minimax-m2.5':        { in:  0.5,  out:  2.0, cr: 0.0,  cw:  0.0,  vendor: 'minimax',   ide: 'multi' },

  // ─── Local / custom (Kilo qwen3.5-35b via vllm) ────────────────────
  // Self-hosted — token cost is electricity + amortization. Treat as 0 for billing analysis.
  'qwen3.5-35b':         { in:  0.0,  out:  0.0, cr: 0.0,  cw:  0.0,  vendor: 'self-host', ide: 'kilo' },

  // ─── Default fallback ───────────────────────────────────────────────
  // Unknown model → conservative estimate (Sonnet-class). Flag in stats output.
  default:               { in:  3.0,  out: 15.0, cr: 0.30, cw:  3.75, vendor: 'unknown',   ide: 'unknown' },
};

// Resolve model string → pricing entry. Tries:
//   1. exact match
//   2. prefix match (claude-sonnet-4-7 → matches "claude-sonnet-4")
//   3. case-insensitive
//   4. default
export const priceOf = (model) => {
  if (!model) return PRICING.default;
  const m = String(model).toLowerCase();
  if (PRICING[m]) return PRICING[m];

  // Sort keys by length desc so longer/more-specific names win prefix race
  const keys = Object.keys(PRICING).filter(k => k !== 'default').sort((a, b) => b.length - a.length);
  for (const k of keys) if (m.startsWith(k.toLowerCase())) return PRICING[k];

  return PRICING.default;
};

// Compute cost given model + usage object. Supports both naming conventions:
//   Anthropic: input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens
//   Cursor CSV: input_with_cache_write, input_without_cache_write, cache_read, output_tokens
export const costOf = (model, u) => {
  const p = priceOf(model);
  // Normalize field names
  const inT = u.input_tokens ?? u.input_without_cache_write ?? u.input ?? 0;
  const cwT = u.cache_creation_input_tokens ?? u.input_with_cache_write ?? u.cache_write ?? 0;
  const crT = u.cache_read_input_tokens ?? u.cache_read ?? 0;
  const outT = u.output_tokens ?? u.output ?? 0;
  return (inT * p.in + outT * p.out + crT * p.cr + cwT * p.cw) / 1_000_000;
};

// IDE attribution: given model name, infer most likely IDE (multi → resolve via context)
export const ideOf = (model, ctx = {}) => {
  if (ctx.source) return ctx.source;
  const p = priceOf(model);
  return p.ide === 'multi' ? (ctx.fallback || 'unknown') : p.ide;
};
