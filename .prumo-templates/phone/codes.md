# Phone codes

## Rule

Sign in by a code texted to a mobile number, with the limits, storage and answers of `codes/codes.md`: the purpose
`sign-in` on the channel `phone`. Serve `POST /api/auth/phone/code` and `phone/sign-in` from
`phone-code.controller.ts`.

Read a number through the `PhoneNumbers` port, whose adapter is `libphonenumber-js/mobile`: the whole input, in
international form, kept as E.164. Refuse what is no mobile number with **422** `invalid_phone`, and a number whose
country is not in `SMS_COUNTRIES` with **422** `phone_not_served`. Neither says anything about accounts.

Keep `SMS_COUNTRIES` required. It names the countries a text may go to as ISO 3166 codes, and the country is the
number's, not its calling code's: `+44` numbers may be GB, GG, IM or JE, and `+1` numbers belong to the United
States, Canada and much of the Caribbean.

Send a code to every number that asks, account or not, and create nothing when it is sent. When it comes back,
sign in the account the number belongs to, or create it then: reached by the phone, without an email, named after
the number's last digits (`•••• 2671`), with the device's locale and timezone.

Write the text plainly: the code, its lifetime, and a warning never to share it. Do not end it with the line
`@<domain> #<code>`: that binds the code to the domain, and the system then offers it only on that site and in an
app associated with it, which the generated app is not. Add the line once the app declares its associated domains.

On a client, give the phone field `type="tel"` and `autoComplete="tel"`, and the code field
`autoComplete="one-time-code"`, which offers a code that just arrived by text on iOS and Android alike.

Change an account's phone with the purpose `change-phone`, the code bound to the account that asked:
`POST /api/v1/users/me/phone/code`, then `POST /api/v1/users/me/phone` (`api/auth.md`).

## Rationale

A text to an expensive destination costs the project money and earns whoever owns that number a share, which is
why texts are sent only where the product's users are. An open list is a bill an attacker runs up by asking for
codes to numbers they pay for; the daily limit per number bounds what one number costs.

The mobile metadata checks the digits as well as the length, and only a mobile number receives a text, so a
landline is refused before a provider is paid to fail. The metadata is the package's, pinned with the project: a
range assigned after that version was released reads as invalid until the package is updated.

A phone needs no confirmation of its own: the only way one reaches an account is a code sent to it.

## Applies to

The routes under `/api/auth/phone`, the `PhoneNumbers` port and its adapter, `SMS_COUNTRIES`, and the screens that
ask for a number and its code.

## Examples

```
✅  "+1 (415) 555-2671"  → +14155552671
❌  "(415) 555-2671"      → invalid_phone: a number without its country code could be anyone's

✅  SMS_COUNTRIES=BR,US
❌  SMS_COUNTRIES unset   → the API does not start
```

## Enforcement

**Boot.** The API does not start without `SMS_COUNTRIES`.

**Tests.** `phone-code.use-case.spec.ts` covers the account created by the first code and only then, the next
sign-in, the dead code, a number never texted, the landline, the country not served and the daily limit.
`phone-code.controller.spec.ts` covers both transports and the 422s, and
`libphonenumber-phone-numbers.adapter.spec.ts` the reading itself.

**Review only.** That `SMS_COUNTRIES` names only where the product's users are.
