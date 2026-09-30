# Errors

## Rule

Throw from the domain a class extending `DomainError`, one per failure, in `domain/<module>/errors/`. Give
it a `kind` from the closed set and a `message` written for the client, because it becomes the `detail`
the client reads.

| `kind` | Status |
|---|---|
| `not_found` | 404 |
| `conflict` | 409 |
| `invalid` | 422 |
| `forbidden` | 403 |
| `unauthorized` | 401 |

Map `kind` to a status in one place only: `src/infra/http/errors/error-handler.ts`. Throw `HttpError` only
from `src/infra/http`, for a condition that exists only in HTTP, such as a missing session. Do not return
an error response from a handler, and do not build a problem document anywhere but in the error handler.

Respond with `application/problem+json` per RFC 9457: `type`, `title`, `status`, `detail`, `instance`,
plus `requestId`.

Answer a request the schema refuses with 400, and carry the fields in an `errors` extension member keyed by
field name, with a dotted key for a nested field. A field the schema does not know is named with the
message `Unrecognized key`.

Give anything else a generic 500 problem document carrying nothing from the error, in every environment.
Send the error itself to the log, and to error reporting once it is installed.

Take the request id from an inbound `X-Request-Id`, or generate one, through Fastify's `requestIdHeader`
and `genReqId`. Return it in `X-Request-Id` on every response and include it in every problem document.

## Rationale

The domain says what went wrong and never how HTTP says it. A `kind` is a fact about the failure, *there is
no such profile*, which holds for an MCP tool as much as for a route; the status is HTTP's translation of
it, and lives with HTTP. A closed set keeps the translation total: the table is a
`Record<DomainErrorKind, number>`, so adding a `kind` without a status does not compile.

`invalid` is 422 rather than 400 so that a client can tell the two refusals apart without reading text:
400 means the request had the wrong shape and says which fields, 422 means the shape was right and a rule
of the product refused it.

One handler builds every error body because otherwise the least predictable failures get the least
predictable shape. Fastify's own errors, the validator's and the domain's all pass through it, so a client
parses one format. Once a single shape is being written, a documented standard costs exactly what a bespoke
one costs, and clients, libraries and assistants already know it.

A 500 says nothing because an unhandled error's message carries whatever was nearby: a file path, a
fragment of SQL, sometimes a connection string. It says the same thing in every environment because the
error path is the least tested code in the system and does not need two versions of itself.

That silence is only supportable because the request id makes it findable. Fastify writes the id into
every log line of the request, not only the one at the moment of failure, since most investigations begin
with what the request did before it threw.

## Applies to

Every error class under `src/domain/`, every route, and `src/infra/http/errors/`, where the handler and the
not-found handler are registered once when the application is built.

## Examples

A domain error:

```
✅  class ProfileNotFoundError extends DomainError { readonly kind = 'not_found' }
❌  class ProfileNotFoundError extends DomainError { readonly status = 404 }
❌  throw new HttpError(404, 'Profile not found')          from a use case
```

A validation failure:

```
✅  { "type": "about:blank", "title": "Bad Request", "status": 400, "detail": "Validation failed",
      "errors": { "displayName": ["Too small: expected string to have >=1 characters"],
                  "role": ["Unrecognized key"] },
      "requestId": "0199…" }

❌  { "statusCode": 400, "code": "FST_ERR_VALIDATION", "message": "body/displayName Too small…" }
```

An unhandled error:

```
✅  { "type": "about:blank", "title": "Internal Server Error", "status": 500,
      "detail": "An unexpected error occurred.", "requestId": "0199…" }

❌  { "status": 500, "detail": "null value in column \"tenant_id\" of relation \"orders\"" }
```

## Enforcement

**Typecheck.** The status table is a `Record<DomainErrorKind, number>`: a `kind` without a status does not
compile.

**Boot.** The error handler and the not-found handler are registered once when the application is built,
so no route produces a different shape by accident.

**Review only.** That the domain throws `DomainError` and never `HttpError`, that a handler throws rather
than answering an error itself, and that no `message` quotes something internal. Nothing checks these.
