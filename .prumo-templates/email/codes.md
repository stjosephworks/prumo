# Email codes

## Rule

Confirm an email address and reset a password with a **6-digit code** sent by mail, never a link. One flow
serves the web and the mobile app alike.

Keep one live code per user and purpose (`verify-email`, `reset-password`) in `email_code`. A code lives
**15 minutes** and allows **5 attempts**; the fifth wrong one kills it. Sending another replaces it, and the old
one stops working. Store only its HMAC-SHA256, keyed with `JWT_SECRET`.

Open no session at sign-up: answer `201 { verificationRequired: true }` and send the code. Refuse sign-in to an
unconfirmed account with **403** and `code: 'email_not_verified'`, and only after the password matched. Sign
the user in when the code is confirmed.

On a password reset, set the new password, mark the email confirmed, and revoke every session of the user before
starting a new one.

Answer `/email/verification` and `/password/forgot` with 204 whether or not the email has an account, and a
wrong code, a dead one and an unknown email with the same `422 invalid_code`.

Read the outcome of a sign-up and of a refused sign-in in the client: `verificationRequired` and
`email_not_verified` both lead to the code screen, which offers to send a new code.

## Rationale

A link needs a page to open: easy on the web, and a deep link with universal links on mobile. A code is typed
the same way everywhere, so there is one flow, one set of screens and one set of tests.

Six digits are a million possibilities, which is why the attempts are counted and the lifetime short: five
guesses against a million cannot succeed by luck. The hash is keyed because a million codes hash in a moment,
so an unkeyed digest in a database copy would give every live code away.

Every answer that could say whether an email has an account says the same thing instead, so these routes cannot
be used to find out who signed up. Asking for confirmation only after the password matched keeps that true at
sign-in too.

A reset revokes every session because whoever knew the old password may have opened one, and the reset is often
the reaction to exactly that.

## Applies to

`src/domain/auth/` for the codes, `auth-email.controller.ts`, and the code, forgot-password and reset-password
screens on the web and mobile.

## Examples

```
✅  POST /api/auth/password/forgot  → 204 for any email
❌  POST /api/auth/password/forgot  → 404 "no account with this email"

✅  sign-in with the right password, unconfirmed → 403 email_not_verified
❌  sign-in, unconfirmed, before checking the password → 403        // tells anyone the account exists
```

## Enforcement

**Tests.** `email.use-case.spec.ts` covers the dead code after five guesses, the replaced code, the unknown email
and the reset revoking sessions. `auth-email.controller.spec.ts` covers the HTTP answers, and the clients'
`email-flows.spec.tsx` the screens.

**Review only.** That a new mail with a code goes through `IssueEmailCodeUseCase`, so it keeps the same limits.
