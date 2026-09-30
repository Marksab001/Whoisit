# whoisit Instagram Relationship Checker
## Full Audit, Remediation, and Open-Source Benchmark

**Audited version:** original 1.0 archive supplied by the user  
**Corrected version:** 2.2.0  
**Audit date:** 30 September 2026  
**Scope:** Chrome/Edge extension, standalone dashboard, relationship comparison, JSON import, privacy, resilience, accessibility, performance, and packaging

## 1. Executive result

The original archive was visually promising but its primary connection path was not deployable as written: a normal website cannot call a browser extension with an empty extension ID, and the extension did not declare an external connection mechanism or website bridge. Stop requests did not stop Instagram fetching, progress updates were discarded, completion timers leaked, and live requests lacked timeout, retry, duplicate-cursor, and useful rate-limit handling.

Versions 2.0.0 through 2.2.0 replace that fragile flow with:

- a bundled dashboard that opens directly from the extension and needs no extension ID;
- a restricted content-script bridge for `cybroatrix.com`, `www.cybroatrix.com`, localhost, and `127.0.0.1`;
- job-based start, progress, polling, completion, error, and cancellation messages;
- conservative request pacing, timeouts, limited retry for transient server errors, explicit 429 handling, and cursor-loop protection;
- adaptive relationship-list passes that stop on a reported-total match or one no-growth retry, with clearly marked partial results when Instagram withholds accounts;
- a pre-analysis follow gate for `@cybroatrix`, enforced in the dashboard and again in the Instagram page worker;
- an official Instagram JSON-export workflow that works entirely offline;
- three exact result categories: does not follow you back, you do not follow back, and mutuals;
- responsive light/dark UI, persistent theme selection, whoisit logo, community links, keyboard-friendly controls, visible progress, search, sorting, result pagination, profile links, CSV export, and JSON export;
- a local development server whose documented `/website/` route is covered by a smoke and regression check;
- dependency-free runtime, deterministic tests, static checks, and a repeatable benchmark.

## 2. Original defects and fixes

| Severity | Original defect | Impact | Version 2.2 remediation |
| --- | --- | --- | --- |
| Critical | Website called `chrome.runtime.sendMessage()` with an empty extension ID | The website could not reliably connect to an unpacked or published extension | Bundled extension dashboard plus allowlisted website bridge |
| Critical | Live scan trusted one apparently complete cursor walk | Instagram page reordering silently omitted 72 followers and 21 following in observed validation, creating false positives | Union adaptive repeated passes; mark incomplete comparisons as partial; keep their exports disabled |
| High | No membership gate existed before live analysis | Live scans could begin without verifying the product's required community follow | Exact target lookup plus `/friendships/show/<id>/`; dashboard remains locked and worker independently refuses analysis until verified |
| High | Missing Instagram profile totals were coerced to zero | A later live test displayed 450 of 0 followers and 463 of 0 following, making a usable capture appear invalid | Support `user` and `data.user`, recover profile-page counts, preserve unknown totals as null, and use no-growth convergence |
| High | Incomplete scans repeated identical passes and hid all output | A 79/78 followers and 15/27 following scan finished in 1:02 but showed no relationships; longer retries could not recover Instagram-withheld accounts | Stop after one no-growth retry; cap passes at three/two; show partial categories with an explicit accuracy warning |
| High | Stop only rejected the background wait | Instagram requests continued after the user pressed Stop | Per-job `AbortController`; stop reaches the Instagram content worker |
| High | Progress messages were received and discarded | Dashboard appeared frozen during long scans | Stored job progress with dashboard polling and processed counts |
| High | No request timeout or 429-specific behavior | Scans could hang or repeatedly stress a rate-limited account | 25-second request timeout, clear 429 stop message, limited 5xx/network retry |
| High | Pagination cursor was not checked for repetition | A bad Instagram response could create a long request loop | Duplicate-cursor set and 5,000-page hard guard |
| Medium | Analysis timer interval was never cleared on success/error | Background work leaked after each scan | Job lifecycle has terminal complete/error/stopped states |
| Medium | Global stop flag allowed concurrent scans to interfere | One scan could stop or corrupt another | Unique job IDs and one active Instagram-tab job at a time |
| Medium | Connection fallback treated any page cookie as login | False connection status and unnecessary script permission | Session endpoint check; removed `scripting` permission and injection fallback |
| Medium | Only fragile private endpoints were supported | Product stopped working whenever live endpoints changed | Official export JSON mode is a reliable local fallback |
| Medium | Only CSV and two categories were available | Limited analysis and result portability | CSV + JSON; non-followers, fans, and mutuals |
| Low | Large result sets rendered in one pass | Slow DOM rendering for high-count accounts | 200-row incremental rendering with Load more |
| Low | Inline single-file dashboard was hard to test and maintain | UI and logic regressions were easy to introduce | Separated HTML/CSS/core/app and synchronized extension build |

## 3. Correctness definition

For normalized, unique username sets:

- **Does not follow you back** = Following minus Followers
- **You do not follow back** = Followers minus Following
- **Mutuals** = Following intersect Followers

The implementation uses `Set` membership, giving expected time complexity `O(n + m)` and expected memory complexity `O(n + m)`. Usernames are normalized to lowercase and duplicate export entries are removed before comparison.

## 4. Test and security results

| Check | Result |
| --- | --- |
| Core/contract/simulated-worker automated tests | 21 passed, 0 failed |
| 100k followers + 100k following exactness test | Passed; 50k non-followers, 50k fans, 50k mutuals |
| JavaScript syntax checks | 12 files passed |
| Manifest validation | MV3, `tabs` + `storage` only, Instagram-only host access |
| Cookie API check | No `chrome.cookies` permission or usage |
| Dynamic code check | No `eval` |
| Unsafe HTML insertion check | No `innerHTML` assignment in application scripts |
| Dashboard source/build parity | Passed for JS, CSS, configuration, core logic, and logo asset |
| Dependency audit | 0 known npm vulnerabilities; no runtime dependencies |
| Original ZIP integrity | Passed decompression test |
| Local HTTP smoke test | `/website/`, logo, and application script returned successfully |

### Test boundary

The comparison engine, JSON parser, exports, build synchronization, message contracts, manifest permissions, simulated reordered pagination, unknown-total handling, partial-result delivery, follow-gate wiring, theme controls, branding, extension icons, and synthetic performance were tested locally. User-provided validation showed the 2.0.1 scanner captured 381 of 453 followers and 444 of 465 following; screenshots confirmed at least one false positive. Version 2.0.2 recovered 450 followers and 463 following but exposed unavailable totals as zero. Version 2.0.3 fixed the count response, then a small-account scan showed Instagram returning only 15 of 27 following accounts and the UI hiding all output after 1:02. Version 2.0.4 stops after one no-growth retry and presents that output as partial. A fresh authenticated live scan of 2.2.0, including the follow-status endpoint, must still be run by the user because the audit environment does not use or retain account cookies. Official export mode remains the exact fallback.

## 5. Synthetic performance benchmark

Runtime: Node.js v24.19.0, Linux x64. Values are medians from warm repeated runs in this audit environment and will vary by device.

| Followers | Following | Median comparison | Expected result |
| ---: | ---: | ---: | --- |
| 1,000 | 1,000 | 0.68 ms | 500 / 500 / 500 |
| 10,000 | 10,000 | 7.21 ms | 5,000 / 5,000 / 5,000 |
| 100,000 | 100,000 | 85.04 ms | 50,000 / 50,000 / 50,000 |

The three result numbers are, in order: does not follow you back / you do not follow back / mutuals. Rendering is separately limited to 200 rows per batch so a correct fast comparison does not produce a slow browser page.

## 6. Open-source comparison

This is a capability and result-delivery benchmark based on each project's public documentation as checked on 28 September 2026. It is not a live account speed race: the tools use different inputs (private web endpoints, official exports, or Instaloader), and no shared authenticated account was supplied.

| Project | Input method | How it gives results | Strongest capability | Main trade-off |
| --- | --- | --- | --- | --- |
| **whoisit 2.2.0** | Live browser session after follow verification **and** official JSON export | Verified results when complete; fast, visibly marked partial results when Instagram withholds accounts | Strong balance of usable live output, transparent confidence, dark/light UI, and exact offline fallback | Partial live categories can contain false positives and cannot be exported; live mode requires following the configured account |
| **UNKchr/ig-analyzer** | Tampermonkey + Instagram internal REST with GraphQL fallback | Instagram overlay with many tabs, history, target audit, and contextual CSV | Broadest live-analysis and historical feature set | More complex; live scraping has rate/action-block risk; custom non-commercial license |
| **Instagram Data Visualizer** | Official JSON/HTML export | Cross-platform Electron dashboard with charts and broad account-data exploration | Richest official-export analysis and privacy posture | No instant live scan; larger desktop installation |
| **SilentSnitch** | Official follower/following JSON export | Flutter app list of unfollowers with profile links | Simple offline, no-login workflow | Manual exports; narrower relationship/report feature set |
| **instagram-monitor** | Instaloader login, Docker, SQLite | Rotating logs, persistent change history, and optional Telegram alerts | Best scheduled monitoring/notification workflow | Requires credentials in environment configuration and technical setup; no polished GUI |

### Documented evidence

- UNKchr/ig-analyzer documents internal Friendships REST use, legacy GraphQL fallback, history, non-followers, target audits, contextual CSV, and deliberate pacing because of rate-limit/action-block risk: https://github.com/UNKchr/ig-analyzer
- Instagram Data Visualizer documents local processing, zero network requests, JSON and HTML export support, multi-folder input, connections analysis, and a cross-platform Electron dashboard: https://github.com/journalismrelay/instagram-data-visualizer
- SilentSnitch documents local official-export comparison without login, a non-follower list, and manual refresh limitations: https://github.com/dyingpotato890/SilentSnitch/releases
- instagram-monitor documents Instaloader, credential configuration, SQLite persistence, rotating logs, Docker, and Telegram notifications: https://github.com/JustShinobi/instagram-monitor

No competitor source code was copied into whoisit. The benchmark influenced product decisions only: safer pacing, explicit limitations, local export support, progressive results, and clearer privacy communication.

## 7. Weighted product scorecard

Scoring: 0 = absent, 3 = present with limitations, 5 = strong. Weights prioritize privacy and dependable results over feature count. Scores are documentation-based and should be rechecked as projects change.

| Criterion | Weight | whoisit 2.2.0 | ig-analyzer | Data Visualizer | SilentSnitch | instagram-monitor |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Privacy / credential safety | 20 | 19 | 16 | 20 | 20 | 9 |
| Result correctness + clarity | 20 | 19 | 18 | 18 | 14 | 16 |
| Resilience to Instagram changes | 15 | 13 | 10 | 14 | 12 | 8 |
| Setup / usability | 15 | 13 | 10 | 10 | 12 | 5 |
| Analysis breadth | 10 | 7 | 10 | 10 | 5 | 8 |
| Export / portability | 10 | 10 | 8 | 7 | 3 | 6 |
| History / monitoring | 10 | 1 | 10 | 4 | 4 | 10 |
| **Total / 100** | **100** | **82** | **82** | **83** | **70** | **62** |

Interpretation: whoisit now competes strongly on privacy, low setup friction, clear relationship results, and dual live/offline input. The clearest remaining gap is opt-in historical comparison. Instagram Data Visualizer leads for broad export exploration; ig-analyzer leads for live feature depth; instagram-monitor leads for unattended history/notifications.

## 8. Recommended next release

1. Add opt-in encrypted local snapshots so users can see new followers, lost followers, and username changes without a server.
2. Add a small fixture-driven browser test suite (Playwright) in CI for dashboard tab switching, JSON upload, search, sorting, pagination, and export downloads.
3. Publish the extension so the production origin and release ID can be tested as a stable pair.
4. Test live mode with a dedicated low-risk Instagram account before public release, beginning with small lists and respecting back-off messages.
5. Add a visible scan-frequency reminder for accounts with thousands of connections.

## 9. Final assessment

The corrected build is suitable for local testing and controlled beta use. Official export mode is the dependable production path. Live mode now verifies the configured follow requirement before analysis, distinguishes unknown totals from zero, ends stalled scans quickly, and labels incomplete categories as partial rather than hiding all output. Partial live results can contain false positives, so exports stay disabled until verification succeeds. Because live mode and follow verification rely on undocumented endpoints, 2.2.0 still requires a fresh user-side validation.
