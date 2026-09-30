<p align="center">
  <img src="website/assets/whoisit-logo.svg" width="96" alt="whoisit logo">
</p>

# whoisit — Instagram Relationship Checker

Privacy-first follower/following comparison for Chrome and Edge. Version **2.2.0** supports a live browser scan and local analysis of Instagram's official JSON export.

> This project is independent and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.

## What it shows

- Accounts you follow that do not follow you back
- Followers you do not follow back
- Mutual connections
- Capture coverage and verification status
- CSV and JSON export for verified results
- Search, sorting, incremental rendering, and light/dark themes

## Privacy model

whoisit never asks for an Instagram password or cookie. Live requests execute inside the already signed-in `instagram.com` tab. The extension has no `cookies` permission, contains no analytics, loads no third-party scripts, and does not upload results. Official export files are processed entirely in the browser.

Never paste session cookies into an issue, chat, screenshot, or configuration file. If a cookie is exposed, sign out of Instagram sessions and rotate the account password.

## Install the extension

1. Download and extract the release ZIP.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the extracted `extension` folder—not the project root.
6. Open [Instagram](https://www.instagram.com/), sign in, and refresh that tab once.
7. Open the whoisit extension and select **Open Dashboard**.

When upgrading an unpacked version, replace the files, select **Reload** on the extensions page, and refresh the Instagram tab. This refresh is required because the page worker is injected when Instagram loads.

## Use live analysis

1. In the dashboard, select **Check connection**.
2. Follow [@cybroatrix](https://www.instagram.com/cybroatrix/) with the signed-in Instagram account.
3. Return to the dashboard and select **Check connection** again. The live-analysis button unlocks only after Instagram confirms the follow relationship.
4. Enter the account you own or are authorized to analyze.
5. Select **Start live analysis** and keep the Instagram tab open.

The follow requirement is enforced both in the dashboard and inside the Instagram worker before relationship pagination begins. Changing only the page UI does not bypass it.

Live scans can be rate-limited or made incomplete by Instagram. A result is marked verified only when its capture reaches the reported totals or stabilizes under the documented retry rule. Partial results are labeled and exports remain disabled.

## Use an official Instagram export

This is the most reliable method for large accounts and does not require the extension or follow check.

1. In Instagram Accounts Center, open **Your information and permissions → Export your information → Export to device**.
2. Choose JSON format and include **Followers and following**.
3. Extract the downloaded archive.
4. Open the dashboard's **Data export** tab.
5. Select all `followers_*.json` files plus `following.json` or `following_*.json`.
6. Select **Analyze selected files**.

## Run the standalone dashboard

Requirements: Node.js 20 or later.

```bash
npm run serve
```

Open `http://localhost:4173/website/`. The extension bridge accepts `localhost`, `127.0.0.1`, `cybroatrix.com`, and `www.cybroatrix.com`. File analysis works without the extension.

## Configure your release

Edit `website/config.js` before building:

```js
globalThis.whoisitConfig = Object.freeze({
  version: "2.2.0",
  requiredFollowUsername: "cybroatrix",
  instagramUrl: "https://www.instagram.com/cybroatrix/",
  githubUrl: "https://github.com/itzstebin",
  discordUrl: "https://discord.gg/MkZFyksWr3"
});
```

Then update visible version strings in `package.json`, `extension/manifest.json`, `website/index.html`, and `extension/popup.html`, and run `npm run build`. See [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for a release checklist.

## Development and verification

There are no runtime npm dependencies.

```bash
npm test
npm run check
npm run benchmark
npm run build
```

- `npm test` runs parsing, comparison, extension-contract, capture-quality, and follow-gate tests.
- `npm run check` validates JavaScript syntax, Manifest V3 policy, expected UI elements, and forbidden cookie/eval/HTML-injection patterns.
- `npm run benchmark` measures the local set-comparison algorithm at 1k, 10k, and 100k records.
- `npm run build` copies the canonical website dashboard, configuration, and assets into `extension/`.

Always run `npm run build` before testing or packaging. Do not edit `extension/dashboard.html`, `dashboard.css`, `dashboard.js`, or `dashboard-core.js` directly; they are generated copies.

## Project layout

```text
website/       Canonical dashboard UI, configuration, core logic, and logo
extension/     Manifest V3 worker, bridges, popup, and built dashboard
tests/         Deterministic Node tests
scripts/       Build, check, serve, benchmark, and reporting utilities
docs/          Configuration, audit, and benchmark documentation
```

## Known limitations

- Live mode depends on undocumented Instagram web endpoints that can change without notice.
- Instagram can rate-limit requests, request a security check, reorder pages, or return incomplete lists.
- Private or restricted profiles may not be available to the signed-in account.
- Exact results for large accounts should use the official export workflow.
- Use the project only for accounts you own or have permission to analyze, and follow applicable platform rules and laws.

## Community

- Developer: [itzstebin on GitHub](https://github.com/itzstebin)
- Community: [Discord](https://discord.gg/MkZFyksWr3)
- Instagram: [@cybroatrix](https://www.instagram.com/cybroatrix/)

Bug reports should include the app version, browser version, scan mode, exact error text, and sanitized steps to reproduce. Never include cookies, passwords, exported account data, or personal results.

## License

[MIT](LICENSE)
