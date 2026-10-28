# Social sign-in

## Rule

Sign in with a provider through the API, never from a client: the client opens
`/api/auth/social/<provider>?client=web|mobile`, the API runs OpenID Connect with `openid-client` behind the
`IdentityProviders` port, and the client comes back signed in. Add a provider in the adapter's `settings()`, its
variables in `env.ts`, and its button on each client.

Store each trip in `social_sign_in`: its id is OAuth's `state`, and the browser that started it holds a secret
in the `social_sign_in` cookie that the callback must present. Use PKCE wherever the provider's metadata announces
it, and a nonce always. Turn Apple's `form_post` callback into a redirect to the same address, so the cookie
comes with it.

Return the web to the path it asked for, only a path, with session cookies, on the web app that started: it sends
its `origin`, which must be in `WEB_ORIGIN`, and the `social_sign_in` cookie carries it to the callback. Return a mobile app
to `MOBILE_APP_SCHEME://social` with a one-time code it exchanges at `/api/auth/social/exchange` for its tokens,
within two minutes. A mobile app opens the trip with `expo-web-browser`'s `openAuthSessionAsync`.

Recognise a returning user by the provider's subject, kept in `identity`. For a first sign-in, link by email
only when the provider says `email_verified`:

- an account whose email was confirmed is the same person: link it;
<!-- prumo:password -->
- an account whose email was never confirmed loses its password and every session, then is linked: the
  provider's proof wins over whoever chose that password (`User.proveEmail`);
<!-- prumo:end-password -->
- no account: create one, confirmed, with its profile.

Refuse a provider email that is not verified.

When the project has a mobile app and offers Google, offer Apple too before publishing on iOS.

When the project offers Apple and sends mail, register every domain it sends from with Apple before going live,
with SPF or DKIM: a user who hides their email gets a relay address, and the relay bounces mail from a source it
does not know.

<!-- prumo:apple -->
Delete an account that signs in with Apple only once Apple confirms it, and revoke Apple's authorization on the
way. `DELETE /api/auth/account` answers **409** `provider_confirmation_required` for it; the client asks
`POST /api/auth/social/apple/deletion` for an address and opens it as it opens a sign-in; the API takes the browser
to Apple on a trip whose `intent` is `delete`. On the callback, revoke the token Apple gives for the code at its
`revocation_endpoint` (`IdentityProviders.revoke`), check that the Apple account is the one the account's identity
names, delete the account, and send the client back to sign-in with `deleted=1`. Keep nothing of Apple's between
sign-ins.
<!-- prumo:end-apple -->

## Rationale

The API keeps the client secret and validates the ID token, so neither a browser nor an app ever holds a
provider's secret or decides what an ID token says.

The cookie binds the trip to one browser. Without it, someone could start a sign-in with their own provider
account and get a victim to open the callback, signing the victim into the attacker's account, which then
records whatever the victim does. The mobile code exists so that tokens never travel in a URL, where logs and
history keep them.

<!-- prumo:password -->
The linking rules close a known attack: register a password account with somebody's email before they arrive,
then wait for them to sign in with a provider. A library this project once used shipped exactly that hole. An
account nobody confirmed belongs to whoever proves the inbox, and that proof is what the provider gives.
<!-- prumo:end-password -->

The App Store asks an app offering a third-party login for its primary account to offer an equivalent
privacy-preserving login too (App Review Guideline 4.8); Sign in with Apple is one.

<!-- prumo:apple -->
Apple asks an app with Sign in with Apple to revoke the user's tokens through its REST API when the account is
deleted, and the App Store asks every app that creates accounts to let them be deleted (App Review Guideline
5.1.1(v)). A token is only had for an authorization code, and a fresh sign-in gives one, so the project keeps no
refresh token to revoke later, which would be a credential to guard for the account's whole life. Signing in with
Apple again is also the recent sign-in a deletion asks for.
<!-- prumo:end-apple -->

**What this costs:** the trip leaves the app for the system browser and comes back, rather than a native sheet.
And a provider without its variables in `.env` answers that it is not configured, until someone registers the
application with it.

<!-- prumo:password -->
In a project that does not verify emails, no password account is ever confirmed, so the first time its owner
signs in with a provider for that email, the password goes: the owner keeps the account through the provider,
and cannot tell them apart from whoever registered the email first.
<!-- prumo:end-password -->

## Applies to

`src/domain/auth/` for identities and trips, `social.controller.ts`, `src/infra/social/`, and the social buttons on
the web and mobile.
<!-- prumo:apple -->
With Apple, also the deletion of an account (`delete-account.use-case.ts`, `delete-account.tsx`).
<!-- prumo:end-apple -->

## Examples

```
✅  a href={auth.socialSignInUrl('google', 'web', redirect)}
❌  window.location = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=…'   // the client talks to Google

✅  link only when email_verified, and end an unconfirmed account's sessions
❌  link whenever the emails match
```

## Enforcement

**Tests.** `social.use-case.spec.ts` covers each linking rule and refuses a callback from another browser, a
second use and another provider. `openid-identity-providers.adapter.spec.ts` runs the real adapter against a
local OpenID provider: PKCE, state, nonce, a forged code, and Apple's client secret signed with the `.p8` key.
`social.controller.spec.ts` covers both clients over HTTP.

<!-- prumo:apple -->
For a deletion, `social.use-case.spec.ts` covers the 409, the revocation and the deletion once Apple confirms,
another Apple account coming back, and a forged ticket; the adapter's spec the revocation itself, and
`social.controller.spec.ts` the whole trip over HTTP. The clients' `delete-account.spec.tsx` covers the step that
sends the person to Apple.
<!-- prumo:end-apple -->

**Review only.** That a new provider's ID token is validated by `openid-client` before anything reads it.
