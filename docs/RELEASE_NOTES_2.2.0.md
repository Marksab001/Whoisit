# whoisit 2.2.0 release notes

## Highlights

- Renamed the product to **whoisit** across the dashboard, extension, exports, source identifiers, documentation, and report.
- Added a new magnifying-person logo plus 16, 32, 48, and 128 pixel browser-extension icons.
- Connected the logo to the dashboard, popup, browser toolbar, extension listing, and website favicon.
- Fixed the local development server so the documented `/website/` URL opens successfully.
- Preserved the required `@cybroatrix` follow verification and existing hosting origins as configuration, not product branding.
- Kept the persistent accessible light/dark theme, privacy-first local processing, developer GitHub, Discord, and Instagram links.

## Verification

- 21 automated tests passed; 0 failed.
- 12 JavaScript files passed syntax checks.
- Manifest V3 retains only `tabs` and `storage` permissions plus the Instagram host permission.
- No cookie permission, embedded session token, `eval`, or application-script `innerHTML` assignment was found.
- 100,000-by-100,000 local comparison: 85.04 ms median on the audit runner.

## Required manual check

Instagram's private endpoints require a real signed-in tab. Before publishing, test the blocked and allowed follow states with a dedicated account, then test a small live scan. Do not share or commit the test account cookie.
