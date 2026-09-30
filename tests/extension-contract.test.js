const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const read = file => readFileSync(resolve(root, file), "utf8");

test("manifest uses least-privilege MV3 configuration", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions.sort(), ["storage", "tabs"]);
  assert.deepEqual(manifest.host_permissions, ["https://www.instagram.com/*"]);
  assert.ok(manifest.content_scripts.some(item => item.js.includes("page-worker.js") && item.world === "MAIN"));
  assert.ok(manifest.content_scripts.some(item => item.js.includes("dashboard-bridge.js")));
});

test("dashboard and background share the complete job protocol", () => {
  const dashboard = read("website/app.js");
  const background = read("extension/background.js");
  for (const type of ["CHECK_CONNECTION", "CHECK_FOLLOW_REQUIREMENT", "START_ANALYSIS", "GET_JOB", "STOP_ANALYSIS"]) {
    assert.match(dashboard, new RegExp(type));
    assert.match(background, new RegExp(type));
  }
});

test("follow gate is carried across every extension boundary", () => {
  for (const file of ["website/app.js", "extension/dashboard-bridge.js", "extension/background.js", "extension/content.js", "extension/page-worker.js"]) {
    assert.match(read(file), /CHECK_FOLLOW_REQUIREMENT|FOLLOW_REQUIREMENT/, `${file} is missing the follow protocol`);
  }
  assert.match(read("website/config.js"), /requiredFollowUsername:\s*"cybroatrix"/);
});

test("dashboard includes dark theme, brand logo, and community links", () => {
  const html = read("website/index.html");
  const css = read("website/styles.css");
  const app = read("website/app.js");
  assert.match(html, /id="themeToggle"/);
  assert.match(html, /assets\/whoisit-logo\.svg/);
  assert.match(html, /github\.com\/itzstebin/);
  assert.match(html, /discord\.gg\/MkZFyksWr3/);
  assert.match(css, /data-theme="dark"/);
  assert.match(app, /whoisit-theme/);
});

test("whoisit branding and extension icons are complete", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  assert.match(manifest.name, /^whoisit/);
  assert.equal(manifest.version, "2.2.0");
  assert.deepEqual(Object.keys(manifest.icons), ["16", "32", "48", "128"]);
  assert.match(read("website/assets/whoisit-logo.svg"), /magnifying glass/);
});

test("local server maps the documented dashboard route", () => {
  assert.match(read("scripts/serve.mjs"), /rawPath === "\/website\/"/);
});

test("Instagram worker reports progress, completion, and errors", () => {
  const content = read("extension/content.js");
  const pageWorker = read("extension/page-worker.js");
  const background = read("extension/background.js");
  for (const type of ["JOB_PROGRESS", "JOB_COMPLETE", "JOB_ERROR"]) {
    assert.match(content, new RegExp(type));
    assert.match(pageWorker, new RegExp(type));
    assert.match(background, new RegExp(type));
  }
});

test("live worker uses current resolution routes and never embeds session tokens", () => {
  const worker = read("extension/page-worker.js");
  assert.match(worker, /web\/search\/topsearch/);
  assert.match(worker, /users\/\$\{encodeURIComponent/);
  assert.doesNotMatch(worker, /web_profile_info/);
  assert.doesNotMatch(worker, /sessionid/);
  assert.match(worker, /X-IG-WWW-Claim/);
  assert.match(worker, /X-CSRFToken/);
});

test("live worker verifies reordered pagination with repeated union passes", () => {
  const worker = read("extension/page-worker.js");
  const dashboard = read("website/app.js");
  assert.match(worker, /maxPasses\s*=\s*type === "followers" \? 3 : 2/);
  assert.match(worker, /converged\s*=\s*pass >= 2 && added === 0/);
  assert.match(worker, /usersByName/);
  assert.match(worker, /captureQuality/);
  assert.match(worker, /reportedKnown/);
  assert.match(worker, /profilePageCounts/);
  assert.match(worker, /followerCapture\.quality\.reliable/);
  assert.match(dashboard, /Partial results — verification incomplete/);
  assert.match(dashboard, /Results are shown immediately but may contain false positives/);
  assert.match(dashboard, /\(partial\)/);
  assert.match(dashboard, /Reported total unavailable/);
});

test("generated extension dashboard matches canonical assets", () => {
  assert.equal(read("extension/dashboard.css"), read("website/styles.css"));
  assert.equal(read("extension/dashboard-core.js"), read("website/core.js"));
  assert.equal(read("extension/dashboard.js"), read("website/app.js"));
  assert.equal(read("extension/config.js"), read("website/config.js"));
  assert.equal(read("extension/assets/whoisit-logo.svg"), read("website/assets/whoisit-logo.svg"));
});
