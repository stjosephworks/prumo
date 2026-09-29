# MCP server

## Rule

Serve MCP at `POST /api/mcp`, in `src/infra/http/controllers/mcp.controller.ts`. Protect it with
`requireMcpAuth` from `@better-auth/mcp`, with the same `resource` as `mcp()` in `auth.factory.ts`:
`mcpResource(env)`. The route is `public: true` for the session hook, because it answers a bearer access
token, never a cookie.

Build the server per request in `src/infra/mcp/mcp.server.ts` with `createMcpHandler` from
`@modelcontextprotocol/server`, `legacy: 'reject'`. The user is the token's `sub`, passed through
`authInfo.extra.userId`.

Write a module's tools in `src/infra/mcp/tools/<module>.tool.ts`. A tool resolves a use case and calls
`execute()`, exactly as a route handler does. Take its input schema from the module's `dto/`, and pass its
result through the module's output schema with `.parse()` before returning it.

Keep Better Auth the authorization server: `jwt()`, `mcp()` and `cimd()` in `auth.factory.ts`, discovery at
`/.well-known/*`, sign-in and consent on the web app. Do not enable dynamic client registration.

## Rationale

MCP is a second edge of the product, beside HTTP, so it reaches the domain the same way: through use cases,
with the user's identity as an argument. A tool that queried a repository would bypass the rules a route
obeys.

`.parse()` is required here and not in a route because Fastify drops a field the response schema does not
list and MCP does not: a tool returns whatever it is handed, so an entity passed straight through publishes
every column.

`legacy: 'reject'` and CIMD follow the MCP 2026-07-28 profile, which Better Auth's plugin targets. The
protocol is stateless, so a server per request costs nothing and knows only its caller. Dynamic client
registration stays off because that profile deprecates it.

## Applies to

`src/infra/mcp/`, `mcp.controller.ts`, the MCP part of `auth.factory.ts`, and the web app's `/consent` route.

## Examples

```
✅  async () => asResult(await container.resolve(FindProfileUseCase).execute(userId))
❌  async () => ({ structuredContent: await em.findOne(Profile, { userId }) })

✅  structuredContent: profileResponseSchema.parse(profile)
❌  structuredContent: profile                       every column leaves
```

## Enforcement

**Tests.** `mcp.controller.spec.ts` walks the whole authorization, consent included, connects the SDK's
own client, and asserts a tool returns only the public fields.

**Review only.** That a new tool goes through a use case and parses its output.
