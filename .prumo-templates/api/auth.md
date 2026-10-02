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
real foreign key and `ON DELETE RESTRICT`, declared in its schema as a to-one relation to `AuthUser` with
`mapToPk: true`, so the domain still holds a plain `userId`. `AuthUser`, in `auth-user.schema.ts`, maps only
the id and is the one Better Auth table the ORM knows. Keep `schemaGenerator.ignoreSchema: ['auth']` and
`skipTables: ['auth.user']` in `mikro-orm.factory.ts`. Better Auth's tables follow Better Auth's conventions,
not `database/entities.md`.

Create what the application keeps about a user in `databaseHooks.user.create.after`, through a use case:
`src/infra/di/index.ts` passes the hook into `createAuth`.

Pin every Better Auth package to one version, and declare `@better-auth/core` as a direct dependency at that
version: `better-auth`, `auth` and every `@better-auth/*` plugin, in the api and in every client. Upgrade them in
one change, never one package at a time.

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
library's schema fights its CLI on every upgrade. Better Auth's migrations run first because an application
table references its tables.

The ORM compares its entities with everything in the database, so without `ignoreSchema` it reads Better
Auth's tables as leftovers and every generated migration drops them, with every login in them. The foreign
key is declared rather than written by hand in a migration because the ORM would otherwise drop that too,
every time. `AuthUser` exists only as that anchor.

`better-auth` pins its core exactly, but each plugin only asks for a compatible core as a peer. Without a
direct `@better-auth/core`, pnpm satisfies that peer with the newest core on the registry, so a core release
installs a second core beside the pinned one, and the plugins stop typechecking against it. One version and
a declared core leave pnpm a single core to install.

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

✅  userId: { kind: 'm:1', entity: () => 'AuthUser' as never, mapToPk: true, deleteRule: 'restrict' }
❌  userId: { type: 'uuid' }                         nothing stops an orphan
```

## Enforcement

**Boot.** The hook is global, so a route is unprotected only by an explicit `public: true`.

**Tests.** `users.controller.spec.ts` signs up through the real route and proves 401 without a session.
`mikro-orm.factory.spec.ts` asserts that a migrated database leaves the schema generator nothing to change,
so a configuration that would drop Better Auth's schema, or the foreign key, fails the suite.

**The database.** A row referencing a user that does not exist is refused.

**Typecheck.** Two cores in one project usually fail `pnpm typecheck` in `src/infra/auth/`.

**Review only.** That an upgrade moves the whole Better Auth family, `@better-auth/core` included. And that
each `public: true` is deliberate: the one mistake that is invisible at runtime, because
the route works, for everyone.
