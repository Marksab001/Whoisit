# Changelog

## 2.2.0 - 2026-09-30

- Renamed the complete project identity to **whoisit**.
- Added a new identity-search logo and complete browser-extension icon set.
- Updated UI copy, extension metadata, exports, internal namespaces, tests, documentation, audit report, and package names.
- Kept `@cybroatrix` as the configured follow-gate account and `cybroatrix.com` as the allowlisted deployment origin.
- Fixed the documented local `/website/` URL so it serves the dashboard instead of returning 404.

## 2.1.0 - 2026-09-30

- Added a required follow check for `@cybroatrix` before live analysis, enforced in both the dashboard and Instagram page worker.
- Added a persistent light/dark theme toggle with accessible state and system-theme default.
- Added the whoisit vector logo to the dashboard and extension popup.
- Added developer GitHub, Discord, and Instagram links to the footer.
- Centralized release links and the required Instagram handle in `website/config.js`.
- Expanded automated contracts for the follow gate, theme, branding, and generated assets.
- Added a public GitHub-ready README, MIT license, security policy, contribution guide, configuration guide, and `.gitignore`.

## 2.0.4 - 2026-09-30

- Reduced live-scan verification to at most three follower passes and two following passes.
- Stop immediately when a captured list reaches Instagram's reported total.
- Stop after one full no-growth retry instead of repeating identical empty passes.
- Show relationship categories as explicitly marked partial results when Instagram stops returning accounts.
- Keep CSV and JSON exports disabled for partial results to avoid presenting them as authoritative.
- Added approximate markers to ratios calculated from partial captures.
- Added a simulated stalled-pagination test that confirms partial results complete after two passes.


## 2.0.3 - 2026-09-29

- Fixed the incorrect `450 of 0` / `463 of 0` status when Instagram omitted profile totals.
- Added support for Instagram user information returned under both `user` and `data.user` response shapes.
- Added a profile-page metadata fallback for follower and following counts.
- Preserved missing totals as unknown instead of coercing them to zero.
- Added convergence verification when totals are unavailable: results unlock only after two consecutive complete passes discover no new accounts.
- Increased safety limits to seven follower passes and six following passes for reordered pagination.
- Added accurate UI messaging for known totals, unknown totals, convergence, and incomplete scans.
- Expanded the automated suite to 16 passing tests.

## 2.0.2 - 2026-09-28

- Fixed false relationship classifications caused by Instagram reordering users between pagination windows.
- Replaced the single cursor walk with repeated full passes and a stable username union (up to five follower passes and four following passes).
- Added reported-versus-captured totals, per-list pass counts, convergence data, and a top-level reliability flag.
- Added a fail-closed accuracy gate: incomplete live captures no longer show or export potentially incorrect relationship categories.
- Added verified/incomplete result banners and clearer progress messages for every verification pass.
- Added deterministic capture-quality and extension contract tests.

## 2.0.1 - 2026-09-28

- Fixed false "Instagram not connected" results caused by the retired/rate-limited `web_profile_info` endpoint.
- Moved Instagram requests into a Manifest V3 `MAIN`-world worker so they run in Instagram's own page context.
- Added safe capture and reuse of Instagram's current request headers without exporting session cookies.
- Resolve usernames through exact `topsearch` matches and obtain account details from `/users/<id>/info/`.
- Increased relationship page size to reduce requests while retaining safe pacing and cancellation.
- Added page-worker bridge contract tests and clearer diagnostics for stale Instagram tabs.

## 2.0.0 - 2026-09-28

- Replaced the broken empty-extension-ID connection path with a bundled dashboard and restricted website bridge.
- Added job-based live scan progress, completion, errors, and real cancellation.
- Added timeouts, conservative pacing, limited retry, rate-limit messaging, pagination-loop protection, and large-result handling.
- Added offline analysis of official Instagram follower/following JSON exports.
- Added mutual results, search, sorting, incremental rendering, direct profile links, CSV export, and JSON export.
- Rebuilt the dashboard as an accessible, responsive light interface with whoisit branding.
- Removed the unnecessary `scripting` permission and retained only `tabs`, `storage`, and Instagram host access.
- Added deterministic unit tests, extension contract tests, static checks, security audit, and performance benchmark.
