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

Return the web to the path it asked for, only a path on the web app, with session cookies. Return a mobile app
to `MOBILE_APP_SCHEME://social` with a one-time code it exchanges at `/api/auth/social/exchange` for its tokens,
within two minutes. A mobile app opens the trip with `expo-web-browser`'s `openAuthSessionAsync`.

Recognise a returning user by the provider's subject, kept in `identity`. For a first sign-in, link by email
only when the provider says `email_verified`:

- an account whose email was confirmed is the same person: link it;
- an account whose email was never confirmed loses its password and every session, then is linked: the
  provider's proof wins over whoever chose that password;
- no account: create one, confirmed and without a password, with its profile.

Refuse a provider email that is not verified.

When the project has a mobile app and offers Google, offer Apple too before publishing on iOS.

## Rationale

The API keeps the client secret and validates the ID token, so neither a browser nor an app ever holds a
provider's secret or decides what an ID token says.

The cookie binds the trip to one browser. Without it, someone could start a sign-in with their own provider
account and get a victim to open the callback, signing the victim into the attacker's account, which then
records whatever the victim does. The mobile code exists so that tokens never travel in a URL, where logs and
history keep them.

The linking rules close a known attack: register a password account with somebody's email before they arrive,
then wait for them to sign in with a provider. A library this project once used shipped exactly that hole. An
account nobody confirmed belongs to whoever proves the inbox, and that proof is what the provider gives.

The App Store asks an app offering a third-party login for its primary account to offer an equivalent
privacy-preserving login too (App Review Guideline 4.8); Sign in with Apple is one.

**What this costs:** the trip leaves the app for the system browser and comes back, rather than a native sheet.
In a project that does not verify emails, no password account is ever confirmed, so the first time its owner
signs in with a provider for that email, the password goes: the owner keeps the account through the provider,
and cannot tell them apart from whoever registered the email first.
And a provider without its variables in `.env` answers that it is not configured, until someone registers the
application with it.

## Applies to

`src/domain/auth/` for identities and trips, `social.controller.ts`, `src/infra/social/`, and the social buttons on
the web and mobile.

## Examples

```
✅  a href={auth.socialSignInUrl('google', 'web', redirect)}
❌  window.location = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=…'   // the client talks to Google

✅  link only when email_verified, and void an unconfirmed account's password
❌  link whenever the emails match
```

## Enforcement

**Tests.** `social.use-case.spec.ts` covers each linking rule and refuses a callback from another browser, a
second use and another provider. `openid-identity-providers.adapter.spec.ts` runs the real adapter against a
local OpenID provider: PKCE, state, nonce, a forged code, and Apple's client secret signed with the `.p8` key.
`social.controller.spec.ts` covers both clients over HTTP.

**Review only.** That a new provider's ID token is validated by `openid-client` before anything reads it.
