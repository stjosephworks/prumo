# Email codes

## Rule

Prove an email address with a **6-digit code** sent by mail, never a link. One flow serves the web and the mobile
app alike.

Keep one live code per destination and purpose in `one_time_code`, keyed by the channel and the normalised
address, through `IssueCodeUseCase`. A code lives **15 minutes** and allows **5 attempts**; the fifth wrong one
kills it. Sending another replaces it, and the old one stops working. Store only its HMAC-SHA256, keyed with
`JWT_SECRET`.

Send one destination at most **one code a minute** and **five an hour**, whoever asks. Refuse more with
**429** `too_many_codes` and a `Retry-After` in seconds; the client's new-code button then counts down from it.
Write the destination's row for every request, whether or not the address has an account, so the limits answer
alike for both.

Each issue deletes, in the same transaction, up to 100 rows whose code is dead and whose day is over. No scheduler
is needed, and nothing is kept about an address longer than the limits read it.

<!-- prumo:email -->
Confirm an address and reset a password with the purposes `verify-email` and `reset-password`, and send their mail
only when the address has an account.

Open no session at sign-up: answer `201 { verificationRequired: true }` and send the code. Refuse sign-in to an
unconfirmed account with **403** and `code: 'email_not_verified'`, and only after the password matched. Sign
the user in when the code is confirmed.

On a password reset, set the new password, mark the email confirmed, and revoke every session of the user before
starting a new one.

Answer `/email/verification` and `/password/forgot` with 204 whether or not the email has an account, and a
wrong code, a dead one and an unknown email with the same `422 invalid_code`.

Read the outcome of a sign-up and of a refused sign-in in the client: `verificationRequired` and
`email_not_verified` both lead to the code screen, which offers to send a new code.
<!-- prumo:end-email -->

<!-- prumo:email-code -->
Sign in with the purpose `sign-in` (`api/auth.md`). Send it to every address that asks, account or not. Answer
`/email/code` with 204, and a wrong code, a dead one and an address that was never sent one with the same
`422 invalid_code`.

Ask for the address, then the code, on one screen. A 429 there still moves on to the code, since the last one sent
is still good.
<!-- prumo:end-email-code -->

## Rationale

A link needs a page to open: easy on the web, and a deep link with universal links on mobile. A code is typed
the same way everywhere, so there is one flow, one set of screens and one set of tests.

Six digits are a million possibilities, which is why the attempts are counted and the lifetime short: five
guesses against a million cannot succeed by luck. The hash is keyed because a million codes hash in a moment,
so an unkeyed digest in a database copy would give every live code away.

Every answer that could say whether an email has an account says the same thing instead, so these routes cannot
be used to find out who signed up.

<!-- prumo:email -->
Asking for confirmation only after the password matched keeps that true at sign-in too. A reset revokes every
session because whoever knew the old password may have opened one, and the reset is often the reaction to exactly
that.
<!-- prumo:end-email -->

The per-IP rate limit does not stop one address being asked for again and again from many addresses, which
fills a mailbox and spends the sending domain's reputation. Counting per destination does, and a 429 only stays
silent about accounts if an address without one is counted the same way, which is why its row is written too.

## Applies to

`src/domain/auth/` for the codes, the controllers that send or take one, and every screen that asks for a code on
the web and mobile.

## Examples

```
✅  POST a request for a code    → 204 for any email
❌  POST a request for a code    → 404 "no account with this email"

✅  a code asked for 20 s after the last  → 429, Retry-After: 40
❌  a code asked for 20 s after the last  → a second mail
```

## Enforcement

**Tests.** `mikroorm-one-time-code.repository.spec.ts` proves the sweep against Postgres.

<!-- prumo:email -->
`email.use-case.spec.ts` covers the dead code after five guesses, the replaced code, the unknown email, the reset
revoking sessions, the limits for an address with and without an account, and the sweep.
`auth-email.controller.spec.ts` covers the HTTP answers and the 429, and the clients' `email-flows.spec.tsx` the
screens and the countdown.
<!-- prumo:end-email -->

<!-- prumo:email-code -->
`email-code.use-case.spec.ts` and `email-code.controller.spec.ts` cover signing in by code, and the clients'
`code.spec.tsx` the two steps and the countdown.
<!-- prumo:end-email-code -->

**Review only.** That a new mail with a code goes through `IssueCodeUseCase`, so it keeps the same limits.
