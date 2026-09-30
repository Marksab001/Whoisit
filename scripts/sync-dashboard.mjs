import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const website = resolve(root, "website");
const extension = resolve(root, "extension");

const html = await readFile(resolve(website, "index.html"), "utf8");
const extensionHtml = html
  .replace("<title>whoisit — Instagram Relationship Checker</title>", "<title>whoisit Dashboard</title>")
  .replace('href="styles.css"', 'href="dashboard.css"')
  .replace('src="config.js"', 'src="config.js"')
  .replace('src="core.js"', 'src="dashboard-core.js"')
  .replace('src="app.js"', 'src="dashboard.js"');

await writeFile(resolve(extension, "dashboard.html"), extensionHtml);
await copyFile(resolve(website, "styles.css"), resolve(extension, "dashboard.css"));
await copyFile(resolve(website, "core.js"), resolve(extension, "dashboard-core.js"));
await copyFile(resolve(website, "app.js"), resolve(extension, "dashboard.js"));
await copyFile(resolve(website, "config.js"), resolve(extension, "config.js"));
await mkdir(resolve(extension, "assets"), { recursive: true });
await cp(resolve(website, "assets"), resolve(extension, "assets"), { recursive: true });
console.log("Dashboard synchronized into extension/.");
