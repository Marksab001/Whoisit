import { access, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jsFiles = [
  "website/core.js",
  "website/config.js",
  "website/app.js",
  "extension/background.js",
  "extension/content.js",
  "extension/page-worker.js",
  "extension/config.js",
  "extension/dashboard-bridge.js",
  "extension/popup.js",
  "scripts/sync-dashboard.mjs",
  "scripts/benchmark.mjs",
  "scripts/serve.mjs"
];

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${file}: ${result.stderr || result.stdout}`);
}

const manifest = JSON.parse(await readFile(resolve(root, "extension/manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Extension must use Manifest V3.");
if ((manifest.permissions || []).includes("cookies")) throw new Error("chrome.cookies permission is forbidden.");
if (!manifest.content_scripts?.some(item => item.js?.includes("dashboard-bridge.js"))) {
  throw new Error("Dashboard bridge is missing from the manifest.");
}

for (const file of [
  "website/index.html",
  "website/styles.css",
  "website/assets/whoisit-logo.svg",
  "extension/popup.html",
  "extension/assets/icon-16.png",
  "extension/assets/icon-32.png",
  "extension/assets/icon-48.png",
  "extension/assets/icon-128.png"
]) {
  await access(resolve(root, file));
}

const dashboard = await readFile(resolve(root, "website/index.html"), "utf8");
for (const id of ["connectButton", "followGate", "themeToggle", "liveStartButton", "fileStartButton", "resultsPanel", "resultList"]) {
  if (!dashboard.includes(`id="${id}"`)) throw new Error(`Dashboard is missing #${id}.`);
}
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(dashboard)) throw new Error("Inline dashboard scripts are forbidden.");

const forbiddenPatterns = [
  [/chrome\.cookies/, "cookie API reference"],
  [/eval\s*\(/, "eval usage"],
  [/\.innerHTML\s*=/, "innerHTML assignment"]
];
for (const file of jsFiles.slice(0, 6)) {
  const source = await readFile(resolve(root, file), "utf8");
  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(source)) throw new Error(`${file}: forbidden ${label}.`);
  }
}

console.log(`Static checks passed (${jsFiles.length} JavaScript files, manifest, HTML, and privacy rules).`);
