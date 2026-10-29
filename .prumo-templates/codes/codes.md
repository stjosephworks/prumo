# One-time codes

## Rule

Prove an address with a **6-digit code** sent to it, never a link. One flow serves the web and the mobile app
alike, by email or by text. What each code is for, and how it travels, is the area of its channel.

Keep one live code per channel, destination and purpose in `one_time_code`, through `IssueCodeUseCase`. The
destination is normalised first: an email lowercased and trimmed, a phone in E.164. A code lives **15 minutes** and
allows **5 attempts**; the fifth wrong one kills it. Sending another replaces it, and the old one stops working.
Store only its HMAC-SHA256, keyed with `JWT_SECRET`.

Send one destination at most **one code a minute** and **five an hour**, and a phone **ten a day**, whoever asks.
Refuse more with **429** `too_many_codes` and a `Retry-After` in seconds; the client's new-code button then counts
down from it. Write the destination's row for every request, whether or not the address has an account, so the
limits answer alike for both.

Each issue deletes, in the same transaction, up to 100 rows whose code is dead and whose day is over. No scheduler
is needed, and nothing is kept about an address longer than the limits read it.

Answer a wrong code, a dead one, and an address that was never sent one with the same `422 invalid_code`.

## Rationale

A link needs a page to open: easy on the web, and a deep link with universal links on mobile. A code is typed
the same way everywhere, so there is one flow, one set of screens and one set of tests.

Six digits are a million possibilities, which is why the attempts are counted and the lifetime short: five
guesses against a million cannot succeed by luck. The hash is keyed because a million codes hash in a moment,
so an unkeyed digest in a database copy would give every live code away.

The per-IP rate limit does not stop one address being asked for again and again from many addresses, which
fills a mailbox, spends the sending domain's reputation, and with a phone costs money on every text. Counting per
destination does, and a 429 only stays silent about accounts if an address without one is counted the same way,
which is why its row is written too.

## Applies to

`src/domain/auth/` for the codes, `IssueCodeUseCase`, the controllers that send or take one, and every screen that
asks for a code on the web and mobile.

## Examples

```
✅  a code asked for 20 s after the last  → 429, Retry-After: 40
❌  a code asked for 20 s after the last  → a second message

✅  one_time_code holds hmac(code)
❌  one_time_code holds the code
```

## Enforcement

**Tests.** `mikroorm-one-time-code.repository.spec.ts` proves the sweep against Postgres, and every channel's use
case spec proves the limits, the dead code and the replaced code.

**Review only.** That a new code goes through `IssueCodeUseCase`, so it keeps the same limits.
