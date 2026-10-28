# Authentication

## Rule

Keep authentication in the `auth` module, as any other module: `User` and `Session` in `entities/`, the access
tokens, the opaque tokens and whatever each way in needs in `ports/`, one use case per action. Their adapters live
in `src/infra/auth/`. No authentication library owns a table, a route or a migration.

Serve `POST /api/auth/refresh` and `sign-out`, and `GET /api/auth/session`, from `auth.controller.ts`, and each
way in from a controller of its own. Answer their errors as every route does, in problem+json.

Issue an access token as a JWT valid for **15 minutes**, signed with `HS256` from `JWT_SECRET`, and name the
algorithm when verifying it. Issue the refresh token as an opaque `<sessionId>.<secret>`, store only its
SHA-256, and **rotate it on every use**. A token from an earlier rotation revokes its session; the one replaced
less than ten seconds ago answers 409 instead, and revokes nothing.

<!-- prumo:password -->
Serve `POST /api/auth/sign-up` and `sign-in` from `password.controller.ts`. Hash passwords with Argon2id through
`@node-rs/argon2`, behind the `PasswordHasher` port, at the library's defaults. When the email is unknown, still
verify the password against a decoy hash, and answer exactly as for a wrong password.
<!-- prumo:end-password -->

<!-- prumo:email-code -->
Serve `POST /api/auth/email/code` and `email/sign-in` from `email-code.controller.ts`. Send a code to any address
that asks, and create nothing when it is sent. When it comes back, sign in the account the address belongs to, or
create it then: confirmed, with its profile named after the address. A code that comes back for an account nobody
had confirmed takes it, as a provider's proof does (`User.proveEmail`). The codes themselves are `email/codes.md`.
<!-- prumo:end-email-code -->

Give the web its tokens in `httpOnly`, `SameSite=Lax` cookies: the access cookie on `/`, the refresh cookie only
on `/api/auth/refresh`, both `Secure` when `API_URL` is https. Give a native client its tokens in the body, and
only when it sends `X-Auth-Transport: bearer`; it then sends `Authorization: Bearer`. Refuse with 403 any
request that changes state, carries a cookie and no bearer, and does not come from an origin in `WEB_ORIGIN`, the comma-separated list of the web apps.

Serve every web app and the API from one site, a single registrable domain such as `app.example.com` and
`api.example.com`. Different subdomains are fine; different domains are not.

Every route is protected by the global `preHandler` hook in `auth.hook.ts`. Mark a route that needs no session
with `config: { public: true }`; that means only *do not answer 401*, and the token is still read. Read the
user in the handler with `currentUser(request)` and pass its id to the use case as an argument. A use case
never reads the request.

Create a user and the application's own row for it in one use case, inside one transaction: the use case that
creates the `User` calls `CreateProfileUseCase`. Take the device's `locale` and `timezone`, both optional, with
the request that creates the account, and use them for the new profile only: a locale the profile does not support
becomes the first one in its language, else English. The clients' contract sends them on its own.

Limit the routes that take a secret, a password or a code, with `@fastify/rate-limit`, through the route's own
`config.rateLimit`. The plugin is registered with `global: false`. It counts by `request.ip`, which is the
client's only when `TRUST_PROXY` names the proxy in front (`api/config.md`).

## Rationale

Authentication is part of the product's data, so it follows the product's rules: one database, one connection,
one migration tool, and a domain that names what it needs through ports. Nothing has to be adapted to a
library's tables, ids or responses, and the user is an entity the ORM knows like any other.

An access token is checked by its signature alone, so no request touches the database to accept one, and
nothing can revoke one before it expires. Fifteen minutes bounds that. The refresh token is what can be
revoked, so it lives in the database, and rotation makes a stolen copy detectable: whoever presents an old one
is not the client that rotated it, and the session ends for both. The ten seconds exist because two tabs
refreshing at once both present the same token, and the second must not sign the user out.

<!-- prumo:password -->
The decoy hash is there because the time a sign-in takes would otherwise say which emails have an account.
<!-- prumo:end-password -->

<!-- prumo:email-code -->
A code creates the account only when it comes back, because sending one proves nothing: an address that never
answers leaves no account behind, and one that answers has proved its inbox, which is all an account by code is.
<!-- prumo:end-email-code -->

A cookie no script can read is a token an injected script cannot take, which is why the web never receives
one in a body. A cookie is also sent by the browser whoever wrote the page, which is what the Origin check
answers: a request leaning on a cookie must come from the web app. A native app has no cookie jar and no
Origin, so it carries a bearer and passes.

The cookies are `SameSite=Lax`, so a browser leaves them off a request one site makes to another: a web app on
another domain would sign in and then be anonymous on every call.

**What this costs:** the security of sign-in is this code's. There is no upstream fix to wait for. The ways in,
email verification, password reset and social sign-in are questions `prumo new` asks; a project that answered no
to one has none of it until it is written.

## Applies to

Every route, every use case that acts for a user, `src/domain/auth/`, and `src/infra/auth/`.

## Examples

```
✅  app.get('/health', { config: { public: true } }, …)
❌  app.get('/health', …)                         401: protected is the default

✅  execute(currentUser(request).id)
❌  execute(request)

✅  jwtVerify(token, key, { algorithms: ['HS256'], issuer, audience })
❌  jwtVerify(token, key)                         the token chooses its own algorithm

✅  sessions store sha256(secret)
❌  sessions store the refresh token
```

## Enforcement

**Boot.** The hook is global, so a route is unprotected only by an explicit `public: true`.

**Tests.** `auth.controller.spec.ts` covers both transports, rotation and the Origin check, signed in through the
project's own way in. `refresh-session.use-case.spec.ts` proves that a replayed token revokes the session and that
one just rotated does not. `jose-access-tokens.adapter.spec.ts` refuses an expired token, another secret, another
issuer, an unsigned token and another algorithm.

<!-- prumo:password -->
`password.controller.spec.ts` covers a wrong password, a taken email, the fields a sign-up gets wrong and the rate
limit; `sign-in.use-case.spec.ts` and `sign-up.use-case.spec.ts` the rest.
<!-- prumo:end-password -->

<!-- prumo:email-code -->
`email-code.use-case.spec.ts` covers the account created by the first code and only then, the next sign-in, the
dead code, the replaced code and the unknown address; `email-code.controller.spec.ts` both transports and the 429.
<!-- prumo:end-email-code -->

**Review only.** That each `public: true` is deliberate: the one mistake that is invisible at runtime, because
the route works, for everyone.
