# Authentication

## Rule

Keep authentication in the `auth` module, as any other module: `User` and `Session` in `entities/`, the
password hasher, the access tokens and the opaque tokens in `ports/`, one use case per action. Their adapters
live in `src/infra/auth/`. No authentication library owns a table, a route or a migration.

Serve `POST /api/auth/sign-up`, `sign-in`, `refresh` and `sign-out`, and `GET /api/auth/session`, from
`auth.controller.ts`. Answer their errors as every route does, in problem+json.

Issue an access token as a JWT valid for **15 minutes**, signed with `HS256` from `JWT_SECRET`, and name the
algorithm when verifying it. Issue the refresh token as an opaque `<sessionId>.<secret>`, store only its
SHA-256, and **rotate it on every use**. A token from an earlier rotation revokes its session; the one replaced
less than ten seconds ago answers 409 instead, and revokes nothing.

Hash passwords with Argon2id through `@node-rs/argon2`, at the library's defaults. When the email is unknown,
still verify the password against a decoy hash, and answer exactly as for a wrong password.

Give the web its tokens in `httpOnly`, `SameSite=Lax` cookies: the access cookie on `/`, the refresh cookie only
on `/api/auth/refresh`, both `Secure` when `API_URL` is https. Give a native client its tokens in the body, and
only when it sends `X-Auth-Transport: bearer`; it then sends `Authorization: Bearer`. Refuse with 403 any
request that changes state, carries a cookie and no bearer, and does not come from `WEB_ORIGIN`.

Every route is protected by the global `preHandler` hook in `auth.hook.ts`. Mark a route that needs no session
with `config: { public: true }`; that means only *do not answer 401*, and the token is still read. Read the
user in the handler with `currentUser(request)` and pass its id to the use case as an argument. A use case
never reads the request.

Create a user and the application's own row for it in one use case, inside one transaction: `SignUpUseCase`
creates the `User` and calls `CreateProfileUseCase`.

Limit the routes that take a password with `@fastify/rate-limit`, through the route's own
`config.rateLimit`. The plugin is registered with `global: false`.

## Rationale

Authentication is part of the product's data, so it follows the product's rules: one database, one connection,
one migration tool, and a domain that names what it needs through ports. Nothing has to be adapted to a
library's tables, ids or responses, and the user is an entity the ORM knows like any other.

An access token is checked by its signature alone, so no request touches the database to accept one, and
nothing can revoke one before it expires. Fifteen minutes bounds that. The refresh token is what can be
revoked, so it lives in the database, and rotation makes a stolen copy detectable: whoever presents an old one
is not the client that rotated it, and the session ends for both. The ten seconds exist because two tabs
refreshing at once both present the same token, and the second must not sign the user out.

The decoy hash is there because the time a sign-in takes would otherwise say which emails have an account.

A cookie no script can read is a token an injected script cannot take, which is why the web never receives
one in a body. A cookie is also sent by the browser whoever wrote the page, which is what the Origin check
answers: a request leaning on a cookie must come from the web app. A native app has no cookie jar and no
Origin, so it carries a bearer and passes.

**What this costs:** the security of sign-in is this code's. There is no upstream fix to wait for, and no
reset of a password, verification of an email or social sign-in until one is written.

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

**Tests.** `auth.controller.spec.ts` covers both transports, rotation, the Origin check, 401, 409, 400 and the
rate limit. `refresh-session.use-case.spec.ts` proves that a replayed token revokes the session and that one
just rotated does not. `jose-access-tokens.adapter.spec.ts` refuses an expired token, another secret, another
issuer, an unsigned token and another algorithm.

**Review only.** That each `public: true` is deliberate: the one mistake that is invisible at runtime, because
the route works, for everyone.
