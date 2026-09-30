# Live count and convergence fix - 2.0.3

## Observed failure

The 2.0.2 dashboard captured 450 followers and 463 following but displayed both values as "of 0 reported." The scan was therefore marked incomplete even though zero was not Instagram's reported count; the count was unavailable.

## Root cause

- Instagram returned user information in a response shape the scanner did not recognize, or withheld the count fields.
- Missing count values were coerced to numeric zero.
- Verification required a reported total and could not use stable multi-pass convergence as a fallback.

## Fix

- Accept both `user` and `data.user` Instagram response shapes.
- Attempt to recover counts from profile-page JSON or Open Graph metadata.
- Store unavailable totals as `null` with `reportedKnown: false`.
- When a total remains unavailable, require two consecutive complete passes that add no new usernames before marking the list reliable.
- Keep the fail-closed behavior when neither a reported-total match nor convergence is achieved.
- Show "Reported total unavailable" instead of the misleading "of 0 reported."
