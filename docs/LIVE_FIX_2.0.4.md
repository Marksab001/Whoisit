# Fast partial-result fix - 2.0.4

## Observed behavior

A live scan completed in 1 minute 2 seconds with 79 of 78 followers and 15 of 27 following. Instagram returned the same 15 following accounts on repeated passes, so additional waiting could not recover the remaining accounts. Version 2.0.3 hid every relationship category because one list was incomplete.

## Change

- A list stops immediately when its unique capture reaches the reported total.
- If a complete retry adds no new usernames, the scanner stops rather than repeating identical requests.
- Followers use at most three passes; following uses at most two passes.
- Incomplete relationship categories are now shown with a visible partial-results warning.
- Partial results may contain false positives and are not exportable.
- Exact results remain available through Instagram's official Data export mode.

## Expected improvement

For the observed small account, the scan should finish after one follower pass and two following passes, then display the partial relationship lists. It should no longer wait through extra no-growth passes or hide all output.
