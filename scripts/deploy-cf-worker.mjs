#!/usr/bin/env node
/**
 * One-shot deploy script for ai-kit telemetry Cloudflare Worker.
 *
 * Usage: node scripts/deploy-cf-worker.mjs
 *
 * What it does:
 *   1. Check wrangler installed → npm i -g wrangler if missing
 *   2. Check Cloudflare login → run `wrangler login` (opens browser OAuth) if not
 *   3. Create KV namespace AI_KIT_TELEMETRY (if not already in wrangler.toml)
 *   4. Update wrangler.toml with KV namespace ID
 *   5. Run `wrangler deploy` → parse Worker URL from output
 *   6. Patch bin/ai-kit.mjs: TELEMETRY_ENDPOINT = "<deployed_url>"
 *   7. Save metadata to cf-worker/.deployed.json (gitignored)
 *
 * Idempotent: re-running just re-deploys; KV namespace + URL preserved.
 */

import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const REPO_ROOT  = path.resolve(__dirname, "..");
const WORKER_DIR = path.join(REPO_ROOT, "cf-worker");
const TOML_PATH  = path.join(WORKER_DIR, "wrangler.toml");
const META_PATH  = path.join(WORKER_DIR, ".deployed.json");
const AIKIT_PATH = path.join(REPO_ROOT, "bin", "ai-kit.mjs");

// ─── tiny CLI helpers ─────────────────────────────────────────────────
const C = {
  cyan:  (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow:(s) => `\x1b[33m${s}\x1b[0m`,
  red:   (s) => `\x1b[31m${s}\x1b[0m`,
  bold:  (s) => `\x1b[1m${s}\x1b[0m`,
  dim:   (s) => `\x1b[90m${s}\x1b[0m`,
};

function step(n, total, label) {
  console.log(`\n${C.cyan(`▶ Step ${n}/${total}`)} ${C.bold(label)}`);
}
function ok(msg)   { console.log(`  ${C.green("✓")} ${msg}`); }
function warn(msg) { console.log(`  ${C.yellow("⚠")} ${msg}`); }
function fail(msg) { console.error(`\n  ${C.red("✗")} ${msg}\n`); process.exit(1); }
function info(msg) { console.log(`  ${C.dim("ℹ")} ${C.dim(msg)}`); }

function runCapture(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", shell: false, ...opts });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

function runInherit(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false, ...opts });
  return r.status === 0;
}

// On Windows, wrangler is `wrangler.cmd`. spawnSync without shell has issues with .cmd
// Use `npx wrangler` instead — works cross-platform without npm global install caveat.
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
function wranglerCapture(args, opts = {}) {
  return runCapture(NPX, ["--yes", "wrangler", ...args], opts);
}
function wranglerInherit(args, opts = {}) {
  return runInherit(NPX, ["--yes", "wrangler", ...args], opts);
}

// ─── steps ────────────────────────────────────────────────────────────

console.log(C.bold("\n┌─────────────────────────────────────────────────────────┐"));
console.log(C.bold("│  Deploy ai-kit telemetry Worker → Cloudflare           │"));
console.log(C.bold("└─────────────────────────────────────────────────────────┘"));

// Step 1: Verify wrangler available (via npx — no global install needed)
step(1, 6, "Check wrangler CLI (via npx)");
const verCheck = wranglerCapture(["--version"]);
if (verCheck.code !== 0) {
  fail(`Không gọi được wrangler qua npx.\nstderr: ${verCheck.stderr}\n\nGợi ý: cài Node.js >= 18, hoặc chạy thủ công: npm i -g wrangler && wrangler --version`);
}
ok(`wrangler ${verCheck.stdout.trim().split("\n")[0]}`);

// Step 2: Check Cloudflare authentication
step(2, 6, "Check Cloudflare authentication");
const whoamiCheck = wranglerCapture(["whoami"]);
const isAuthed = whoamiCheck.code === 0 && /associated with the email|account name/i.test(whoamiCheck.stdout + whoamiCheck.stderr);

if (!isAuthed) {
  warn("Chưa đăng nhập Cloudflare.");
  info("wrangler sẽ mở browser → bạn bấm 'Allow' → token lưu vào ~/.wrangler/config/");
  console.log(C.dim("  (Nếu browser không tự mở, copy URL từ terminal vào trình duyệt.)\n"));
  if (!wranglerInherit(["login"])) {
    fail("Login thất bại. Thử thủ công: npx wrangler login");
  }
  // Re-verify
  const recheck = wranglerCapture(["whoami"]);
  if (recheck.code !== 0) fail("Login OK nhưng `wrangler whoami` vẫn fail. Kiểm tra ~/.wrangler/config/");
  ok("Login thành công");
} else {
  const emailMatch = (whoamiCheck.stdout + whoamiCheck.stderr).match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  ok(`Đã đăng nhập${emailMatch ? `: ${emailMatch[0]}` : ""}`);
}

// Step 3: KV namespace
step(3, 6, "Tạo / verify KV namespace AI_KIT_TELEMETRY");

if (!fs.existsSync(TOML_PATH)) fail(`Không tìm thấy ${TOML_PATH}`);
let toml = fs.readFileSync(TOML_PATH, "utf8");

const idMatch = toml.match(/\[\[kv_namespaces\]\][\s\S]*?id\s*=\s*"([a-f0-9]{32})"/);
let kvId = null;

if (idMatch) {
  kvId = idMatch[1];
  ok(`KV namespace đã có: ${C.dim(kvId.substring(0, 8) + "...")}`);
  info("Bỏ qua bước create. Nếu muốn tạo mới: xoá id trong wrangler.toml rồi rerun.");
} else {
  info("Tạo KV namespace mới...");
  // wrangler v3.60+: `wrangler kv namespace create <NAME>` (no colon)
  // wrangler v3.0-3.59: `wrangler kv:namespace create <NAME>` (with colon)
  // Try new syntax first; fall back to old if "Unknown command"
  let createOut = wranglerCapture(["kv", "namespace", "create", "AI_KIT_TELEMETRY"], { cwd: WORKER_DIR });
  if (createOut.code !== 0 && /unknown command|did you mean/i.test(createOut.stderr)) {
    createOut = wranglerCapture(["kv:namespace", "create", "AI_KIT_TELEMETRY"], { cwd: WORKER_DIR });
  }
  if (createOut.code !== 0) {
    fail(`Tạo KV namespace thất bại.\nstdout: ${createOut.stdout}\nstderr: ${createOut.stderr}`);
  }
  const newIdMatch = createOut.stdout.match(/id\s*=\s*"([a-f0-9]{32})"/);
  if (!newIdMatch) {
    fail(`Không parse được KV ID từ output:\n${createOut.stdout}`);
  }
  kvId = newIdMatch[1];
  toml = toml.replace(/<KV_NAMESPACE_ID>/g, kvId);
  fs.writeFileSync(TOML_PATH, toml);
  ok(`KV namespace tạo mới: ${C.dim(kvId.substring(0, 8) + "...")}`);
  ok(`Patched wrangler.toml`);
}

// Step 4: Deploy Worker
step(4, 6, "Deploy Worker");
info("Lệnh: wrangler deploy (trong cf-worker/)");
const deployOut = wranglerCapture(["deploy"], { cwd: WORKER_DIR });

// Print deploy output for transparency (truncated)
const deployStdout = (deployOut.stdout + deployOut.stderr).trim();
console.log(C.dim(deployStdout.split("\n").map(l => "    " + l).join("\n")));

if (deployOut.code !== 0) {
  fail(`Deploy thất bại. Sửa lỗi và rerun. (Có thể chạy thủ công: cd cf-worker && wrangler deploy)`);
}

const urlMatch = deployStdout.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\b/);
if (!urlMatch) {
  fail(`Không parse được Worker URL từ output. Tìm thủ công trong stdout phía trên.`);
}
const workerUrl = urlMatch[0];
ok(`Worker URL: ${C.bold(workerUrl)}`);

// Step 5: Patch bin/ai-kit.mjs
step(5, 6, "Cập nhật TELEMETRY_ENDPOINT trong bin/ai-kit.mjs");

if (!fs.existsSync(AIKIT_PATH)) fail(`Không tìm thấy ${AIKIT_PATH}`);
let aikit = fs.readFileSync(AIKIT_PATH, "utf8");
const tBefore = aikit;

const endpointPattern = /const\s+TELEMETRY_ENDPOINT\s*=\s*"[^"]*";/;
if (endpointPattern.test(aikit)) {
  aikit = aikit.replace(endpointPattern, `const TELEMETRY_ENDPOINT = "${workerUrl}";`);
} else {
  // Insert constant right above TELEMETRY_CONFIG_PATH
  aikit = aikit.replace(
    /const TELEMETRY_CONFIG_PATH\s*=/,
    `const TELEMETRY_ENDPOINT    = "${workerUrl}";\nconst TELEMETRY_CONFIG_PATH =`
  );
}

if (aikit === tBefore) {
  warn("Không thay đổi được ai-kit.mjs.");
  warn(`Hardcode tay: const TELEMETRY_ENDPOINT = "${workerUrl}";`);
} else {
  fs.writeFileSync(AIKIT_PATH, aikit);
  ok(`Patched: TELEMETRY_ENDPOINT = "${workerUrl}"`);
}

// Step 6: Save metadata + smoke test
step(6, 6, "Smoke test + lưu metadata");

const meta = {
  url: workerUrl,
  kv_namespace_id: kvId,
  deployed_at: new Date().toISOString(),
  worker_name: "ai-kit-telemetry",
};
fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
ok(`Metadata lưu: cf-worker/.deployed.json`);

// Health check via fetch
try {
  info(`Test: curl ${workerUrl}/health`);
  const healthRes = await fetch(`${workerUrl}/health`);
  const healthBody = await healthRes.json();
  if (healthRes.ok && healthBody.ok) {
    ok(`Worker live: ${C.dim(JSON.stringify(healthBody))}`);
  } else {
    warn(`Worker response không như expected: ${JSON.stringify(healthBody)}`);
  }
} catch (e) {
  warn(`Health check fail (Worker có thể đang propagate, đợi 30s rồi test lại): ${e.message}`);
}

// Final summary
console.log("\n" + C.green(C.bold("✓ Deploy hoàn tất")));
console.log(`
  ${C.dim("Worker URL:")}    ${C.bold(workerUrl)}
  ${C.dim("KV namespace:")}  ${kvId.substring(0, 8)}...
  ${C.dim("ai-kit.mjs:")}    TELEMETRY_ENDPOINT đã hardcode

${C.bold("Bước tiếp theo:")}
  1. Test sync local:    ${C.cyan("node bin/ai-kit.mjs telemetry sync")}
  2. Xem KV trong CF:    ${C.cyan(`https://dash.cloudflare.com/?to=/:account/workers/kv/namespaces`)}
  3. Logs realtime:      ${C.cyan("cd cf-worker && npx wrangler tail")}
  4. Publish dist mới:   ${C.cyan('pwsh publish.ps1 "feat(telemetry): Phase 2 — auto-sync to CF Worker"')}
`);
