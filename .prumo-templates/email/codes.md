# Email codes

## Rule

Send a code by mail through the `Mailer` port, with the limits, storage and answers of `codes/codes.md`.

<!-- prumo:email -->
Confirm an address and reset a password with the purposes `verify-email` and `reset-password`, and send their mail
only when the address has an account.

Open no session at sign-up: answer `201 { verificationRequired: true }` and send the code. Refuse sign-in to an
unconfirmed account with **403** and `code: 'email_not_verified'`, and only after the password matched. Sign
the user in when the code is confirmed.

On a password reset, set the new password, mark the email confirmed, and revoke every session of the user before
starting a new one.

Answer `/email/verification` and `/password/forgot` with 204 whether or not the email has an account.

Read the outcome of a sign-up and of a refused sign-in in the client: `verificationRequired` and
`email_not_verified` both lead to the code screen, which offers to send a new code.
<!-- prumo:end-email -->

<!-- prumo:email-code -->
Sign in with the purpose `sign-in` (`api/auth.md`). Send it to every address that asks, account or not, and answer
`/email/code` with 204.

Ask for the address, then the code, on one screen. A 429 there still moves on to the code, since the last one sent
is still good.
<!-- prumo:end-email-code -->

## Rationale

Every answer that could say whether an email has an account says the same thing instead, so these routes cannot
be used to find out who signed up.

<!-- prumo:email -->
Asking for confirmation only after the password matched keeps that true at sign-in too. A reset revokes every
session because whoever knew the old password may have opened one, and the reset is often the reaction to exactly
that.
<!-- prumo:end-email -->

## Applies to

The routes under `/api/auth/email` and `/api/auth/password`, and the screens that ask for a code sent by email.

## Examples

```
✅  POST a request for a code    → 204 for any email
❌  POST a request for a code    → 404 "no account with this email"
```

## Enforcement

<!-- prumo:email -->
**Tests.** `email.use-case.spec.ts` covers the dead code after five guesses, the replaced code, the unknown email,
the reset revoking sessions, the limits for an address with and without an account, and the sweep.
`auth-email.controller.spec.ts` covers the HTTP answers and the 429, and the clients' `email-flows.spec.tsx` the
screens and the countdown.
<!-- prumo:end-email -->

<!-- prumo:email-code -->
**Tests.** `email-code.use-case.spec.ts` and `email-code.controller.spec.ts` cover signing in by code, and the
clients' `code.spec.tsx` the two steps and the countdown.
<!-- prumo:end-email-code -->
