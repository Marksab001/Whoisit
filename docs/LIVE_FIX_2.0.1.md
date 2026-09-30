# Live connection fix - v2.0.1

Version 2.0.1 fixes the live scanner reporting **Instagram not connected** even while the user is signed in.

## Root cause

The earlier build attempted `web_profile_info` during user resolution. That route now commonly returns HTTP 429 or an HTML response for valid browser sessions. The old isolated-world fetch also used a fixed app ID without all of Instagram's current request headers.

## Fix

- Live API work now runs in an Instagram `MAIN`-world content worker.
- The worker observes Instagram's own current `X-IG-App-ID`, `X-ASBD-ID`, `X-IG-WWW-Claim`, and CSRF request headers.
- Header values and cookies never leave the Instagram tab.
- Login detection uses the local `ds_user_id` marker and `/api/v1/users/<id>/info/`.
- Username resolution uses an exact result from `/api/v1/web/search/topsearch/`.
- `web_profile_info` is no longer called.
- The extension still has no `chrome.cookies` permission.

## Required upgrade steps

1. Remove or replace the old extracted project folder.
2. Extract v2.0.1.
3. Open `chrome://extensions` or `edge://extensions`.
4. Select **Reload** on the whoisit extension.
5. Refresh the existing Instagram tab. This is required because content scripts load when the page loads.
6. Confirm Instagram is signed in, then reopen the extension dashboard.

If the dashboard still cannot connect, open a fresh Instagram tab, wait for the home feed to load, and select **Check connection** again.
