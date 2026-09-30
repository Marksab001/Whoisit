# Live accuracy fix — 2.0.2

## Observed failure

A live scan reported 381 followers and 444 following while Instagram displayed 453 followers and 465 following. The missing 72 followers and 21 following produced false relationship classifications.

## Root cause

Instagram's internal relationship endpoint can reorder accounts between cursor pages. A single pagination walk can therefore finish normally while skipping users at shifted page boundaries.

## Fix

- Perform at least two complete passes over each relationship list.
- Union usernames across passes with stable de-duplication.
- Allow up to five follower passes and four following passes.
- Stop early only after the union matches Instagram's reported total or a later pass adds no users.
- Store pass count, page count, newly discovered users, cursor-loop status, coverage, and verification status.
- Mark the overall result reliable only when both lists meet their reported totals after repeated passes.
- If verification fails, show captured/reported totals but hide and disable relationship categories and exports to prevent false positives.

## Expected behavior

The same account should now either produce a verified capture matching Instagram's displayed totals, or a clear incomplete warning. It must never silently present a partial list as a 100% accurate comparison.
