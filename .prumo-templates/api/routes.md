# Routes

## Rule

Serve every route at `/api/v<n>/<resource>`: register each controller with
`prefix: '/api/v<n>/<resource>'`. `/api/auth/*`, `/api/health/*` and `/api/docs`, and with MCP `/api/mcp`,
`/api/oauth/*` and `/.well-known/*`, are the only routes outside a version. They answer with the statuses their
own contracts set.

Name resources in the plural, kebab-case for compound words. Use REST verbs. A `POST` answers `201`
through `reply.code(201)`; every other method answers `200`.

Write one controller per module, `src/infra/http/controllers/<module>.controller.ts`, as a Fastify plugin
declared with `function`. Its handler reads the request, resolves one use case from the container, calls
`execute()` and returns the result. Nothing else happens in a handler.

Declare every route's schemas from the module's `dto/`: `body`, `querystring` and `params` for what enters,
`response` for what leaves, keyed by status. Write input schemas with `z.strictObject`, output schemas with
`z.object`. Convert a query or path value that is not a string with `z.coerce`, in the schema.

Write one output schema per shape the API exposes, named after the entity: `profile-response.dto.ts`. Every
route and every MCP tool returning that shape uses it. Write another only when the shape differs, and name
the difference: `profile-summary-response.dto.ts`. Declare dates in an output schema as `z.date()`.

Tag every route with its module. Describe by hand only what a schema cannot say: a non-obvious status, an
error a route answers on purpose.

Serve the documentation UI outside production only.

## Rationale

The prefix makes the authentication and protocol routes fall out of the ordinary convention instead of each
becoming the one route with an exception in its path. They stay outside a version because what shapes them is
what they implement, OAuth's discovery above all, whose addresses are fixed by its RFCs.

Versioning costs five characters today and a coordinated migration of every consumer later, including a
published mobile app that does not update when you want it to. It goes in the URI rather than a header
because a version in the URL appears in logs, caches, a `curl` line and an error report: exactly where you
look when v1 breaks.

`z.strictObject` is what makes an unexpected property visible. Stripping it silently returns 200 to a
client that sent `role: "admin"`, which looks like success and hides the honest bug and the malicious
attempt equally.

On the way out the opposite is wanted, and `z.object` gives it: Fastify serializes through the response
schema and drops every field it does not list. The schema is therefore the list of what may leave. It is
written once per shape, because three schemas over one entity would each have to remember to leave out
`tenant_id`, and so would the fourth someone adds later. A route with no response schema would fall back
to `JSON.stringify` and publish every column, which is why the application refuses to start with one.

A date is `z.date()` because the entity holds a `Date` and Fastify writes it as ISO 8601. `z.iso.datetime()`
and `.transform()` both fail at runtime on a `Date`, with a 500.

The OpenAPI document is generated from the same schemas the routes validate with. A description written by
hand beside them is the copy nobody updates, and documentation that lies is worse than none, because
consumers trust it.

`201` on `POST` is the status code clients already receive: the rule was Nest's default before, and is
written down now that no framework supplies it.

## Applies to

Every controller under `src/infra/http/controllers/`, every schema under `src/domain/<module>/dto/`, and
`src/infra/http/app.ts`, where the prefixes, the compilers and the documentation are registered.

## Examples

Resource naming and versioning:

```
✅  app.register(billingAccountsController, { prefix: '/api/v1/billing-accounts' })
❌  app.register(billingAccountsController, { prefix: '/billingAccount' })
```

What enters and what leaves:

```
✅  body: updateProfileSchema          z.strictObject({ … })
    response: { 200: profileResponseSchema }
❌  body: z.object({ … })               an unknown field passes, silently dropped
❌  { schema: { body: … } }             no response: every column leaves
```

A value from the query string:

```
✅  page: z.coerce.number().int().min(1)
❌  page: z.number()                    always a string on the wire, always a 400
```

A handler that delegates:

```
✅  async (request) => app.container.resolve(FindProfileUseCase).execute(currentUser(request).id)
❌  async (request) => {
      const profile = await app.container.resolve(FindProfileUseCase).execute(id)
      if (profile.plan === 'trial' && profile.createdAt < cutoff) profile.plan = 'expired'
      return profile
    }
```

## Enforcement

**Boot.** `src/infra/http/app.ts` refuses to start when a route under `/api/v` declares no response
schema, and names it. The compilers, the prefix and the documentation are registered once there, so a
route cannot opt out of them by accident.

**Review only.** Resource naming, the thinness of a handler, `201` on `POST`, `z.strictObject` on input,
and (most importantly) whether a new sensitive column has stayed out of the output schema. The schema
lists what leaves, so a field is only published when somebody adds it to that list.
