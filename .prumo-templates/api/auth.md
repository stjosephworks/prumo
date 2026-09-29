# Authentication

## Rule

Mount Better Auth at `/api/auth/*` with the catch-all route in `src/infra/http/controllers/auth.controller.ts`,
which rebuilds the request for `auth.handler`, as Better Auth's Fastify guide does. Mark it
`config: { public: true }`.

Every route is protected by the global `preHandler` hook in `src/infra/http/hooks/auth.hook.ts`. Mark a route
that needs no session with `config: { public: true }`; that means only *do not answer 401*, and the session is
still read.

Read the user in the handler with `currentUser(request)` and pass its id to the use case as an argument. A use
case never reads the request or any ambient session.

Keep Better Auth's tables in their own Postgres schema, `auth`, on their own connection, migrated by its own
CLI from the compiled `dist/infra/auth/auth.cli.js`, before our migrations. `pnpm db:migrate` does both, in
that order.

Set `advanced.database.generateId` to `'uuid'`. Reference `auth.user(id)` from an application table with a
real foreign key and `ON DELETE RESTRICT`. Better Auth's tables follow Better Auth's conventions, not
`database/entities.md`.

Create what the application keeps about a user in `databaseHooks.user.create.after`, through a use case:
`src/infra/di/index.ts` passes the hook into `createAuth`.

## Rationale

The route sits inside Fastify, so the request id and the logs cover the authentication flow. **The error
handler does not:** Better Auth writes its own responses, so an authentication error arrives as
`{ message, code }`, not as problem+json. The client converts it; the server does not rewrite another
library's responses.

Protected is the default because of the asymmetry between the two mistakes. A route someone forgot to
protect is open, and nothing breaks. A route someone forgot to mark public answers 401 on the first call and
is fixed in seconds.

The user arrives as an argument so a use case's signature says what it needs, and its test passes an id
instead of building a request.

Better Auth's ids are `text` by default, which no `uuid` column can reference; `generateId: 'uuid'` fixes
that. What stays different is not ours to fix: camelCase columns and `gen_random_uuid()`. Rewriting another
library's schema fights its CLI on every upgrade. Its migrations run first because an application table
references its tables.

**The sign-up hook is not atomic:** the user and the application's row are written over two connections, so
a failure between them leaves a user without a profile. The result is a visible 404, not corrupted data. And
the foreign key means deleting a user fails while rows reference it, so the application removes them first.

## Applies to

Every route, every use case that acts for a user, and `src/infra/auth/`, where Better Auth is built.

## Examples

```
✅  app.get('/health', { config: { public: true } }, …)
❌  app.get('/health', …)                         401: protected is the default

✅  execute(currentUser(request).id)
❌  execute(request)

✅  foreign key ("user_id") references "auth"."user" ("id") on delete restrict
❌  "user_id" uuid not null                        nothing stops an orphan
```

## Enforcement

**Boot.** The hook is global, so a route is unprotected only by an explicit `public: true`.

**Tests.** `users.controller.spec.ts` signs up through the real route and proves 401 without a session.

**The database.** A row referencing a user that does not exist is refused.

**Review only.** That each `public: true` is deliberate: the one mistake that is invisible at runtime, because
the route works, for everyone.
