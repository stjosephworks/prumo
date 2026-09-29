# Observability

## Rule

Expose two public health routes in `src/infra/http/controllers/health.controller.ts`. `/api/health/live`
checks nothing. `/api/health/ready` checks the database with `orm.checkConnection()` and answers 503 when it
is down.

Connect the ORM explicitly in `server.ts`, before the application listens.

Do not install an error-reporting or tracing service by default. A project has structured logs and these two
routes, and nothing else, until its owner chooses otherwise.

When Sentry is chosen, wire it exactly as follows:

- Install `@sentry/node`. Call `Sentry.init` in `src/infra/observability/instrument.ts`, with
  `Sentry.fastifyIntegration()` in `integrations`, and import that file as the first line of `server.ts`,
  before `reflect-metadata`.
- Give `fastifyIntegration` a `shouldHandleError` that uses the status the error handler resolves, so only a
  5xx becomes an event. Export that mapping from `error-handler.ts` rather than writing a second one.
- Do not call `setupFastifyErrorHandler`: in `@sentry/node` 11 it does nothing.
- Attach the request id as a tag, and the user's id when a session exists. Leave PII sending off. Never
  attach a request body.

## Rationale

Liveness and readiness answer opposite questions, *should I restart this process* and *should I send it
traffic*, and one endpoint forces one answer to both. The routine failure: the endpoint checks the database,
the database wobbles, and the orchestrator restarts a healthy process.

**MikroORM 7's `init` no longer connects.** Without the explicit connect, readiness reports the database down
until a first query, and no query reaches an instance that is not ready. Connecting first also means an
unreachable database fails the boot instead of a request.

Error reporting is not installed because it requires a commercial account: an account, a DSN and eventually a
bill is a commercial decision made on the owner's behalf. The wiring is written down and absent until wanted.

`Sentry.init` must run before other modules load, because the instrumentation patches them as they are
imported. The status comes from our mapping because a domain error carries a `kind`, not a status: a filter
reading the error alone would count a 404 as a 500 and fill the issue list with invalid client input.

**What reaches Sentry leaves your perimeter**, readable by anyone with access to that project. That is why
the body never goes: on an authentication route it is the password.

## Applies to

`server.ts`, the health controller, and `src/infra/observability/` once error reporting is installed.

## Examples

```
✅  GET /api/health/live     process is up, checks nothing
    GET /api/health/ready    database answers
❌  GET /api/health          used for both

✅  Sentry.fastifyIntegration({ shouldHandleError: (error) => statusOf(error) >= 500 })
❌  Sentry.setupFastifyErrorHandler(app)
```

## Enforcement

**Boot.** The health routes are registered once, and the ORM connects before listening.

**Review only, and this is the weakest line in the project:** that `instrument.ts` stays the first import.
Reordering imports, or a formatter doing it unasked, silently stops the instrumentation, and nothing fails.
