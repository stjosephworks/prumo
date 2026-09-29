# Logging

## Rule

Log through Fastify's built-in Pino: `request.log` inside a request, `app.log` outside one. Do not add a
second logging library.

Write JSON to stdout. Render it with `pino-pretty` in development only, as a dev dependency. Never write a log
file. Tests run without a logger.

Keep Fastify's request logging on. Every line of a request carries its id, the same one returned in
`X-Request-Id`. Silence the health routes with `logLevel: 'silent'`.

Never log a request or response body. Keep the `redact` paths in `src/infra/http/app.ts` for the
`authorization`, `cookie` and `set-cookie` headers.

Set the level from `LOG_LEVEL`:

- `error`: it broke and somebody has to look
- `warn`: it degraded and continued: a retry, a fallback, a limit reached
- `info`: an event that matters to the business
- `debug`: off in production

A handled 4xx is not an error. The error handler logs only a 500.

## Rationale

Pino emits structured JSON, which is what an aggregator expects, and Fastify gives each request a child
logger carrying its id, so the id needs no second storage mechanism.

Pretty-printing in development changes only how bytes are rendered for a person; nothing depends on the output
format. That is why this environment difference is allowed where the error-response one is not.

Request logging exists because *did this request even arrive* is the first question in half of all
investigations. Health checks are silenced because a probe every five seconds is seventeen thousand lines a
day saying nothing is wrong.

Levels carry a written rule because the names look self-explanatory and are not. When a 400 from a careless
client is logged as `error`, the error rate stops measuring health, the alert fires constantly, and someone
silences the alert that mattered.

## Applies to

Every file that logs. The logger, redaction and silenced routes are configured when the application is built.

## Examples

```
✅  warn   payment retried after gateway timeout
❌  error  validation failed: email must be an email

✅  request.log.info({ userId: user.id }, 'subscription activated')
❌  request.log.info({ user }, 'subscription activated')      whatever user carries goes too
```

## Enforcement

**Configuration.** Redaction and the silenced routes are set once.

**Review only.** That no one logs a whole object whose contents are unknown: `redact` covers named paths, so
`{ user }` with a token inside defeats it. Access to the logs is a security boundary: an unhandled error is
sent there in full.
