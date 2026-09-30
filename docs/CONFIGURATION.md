# Configuration and release guide

## Brand and links

The canonical runtime configuration is `website/config.js`. Set the required Instagram username without `@`, and keep `instagramUrl` synchronized with it. `npm run build` copies the file to `extension/config.js`.

Footer links live in `website/index.html`. The extension popup link lives in `extension/popup.html`. The vector logo is `website/assets/whoisit-logo.svg` and is copied into the extension during the build.

## Website origins

External dashboards need matching entries in both:

- `extension/manifest.json` under the dashboard bridge content-script matches
- `extension/background.js` in `ALLOWED_DASHBOARD_ORIGINS`

Keep this list explicit. Do not use broad wildcard origins.

## Release checklist

1. Update versions in `package.json`, `package-lock.json`, `extension/manifest.json`, `website/config.js`, `website/index.html`, and `extension/popup.html`.
2. Add the release notes to `CHANGELOG.md`.
3. Run `npm run build`.
4. Run `npm test` and `npm run check`.
5. Run `npm run benchmark` and retain the result with the release notes.
6. Search the repository for secrets, session cookies, generated personal results, and absolute local paths.
7. Load `extension/` unpacked in Chrome and Edge.
8. Verify light/dark themes, follow-gate blocked/allowed states, live cancellation, partial-result messaging, JSON file analysis, and exports.
9. Package the documented public files only; exclude previous releases, temporary files, and local test data.

## Changing the follow requirement

Change `requiredFollowUsername` and `instagramUrl` in `website/config.js`, then run `npm run build`. Do not remove the worker-side check: the dashboard check is for UX, while the worker check is the actual enforcement boundary.
