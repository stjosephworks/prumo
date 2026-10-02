# MCP server

## Rule

Serve MCP at `POST /api/mcp`, in `src/infra/http/controllers/mcp.controller.ts`. Accept only a bearer access
token whose audience is `mcpResource(env)` and which names a client; answer anything else with 401 and a
`WWW-Authenticate` naming `resource_metadata`. The route is `public: true` for the session hook, because the
audience decides, not the session.

Build the server per request in `src/infra/mcp/mcp.server.ts` with `createMcpHandler` from
`@modelcontextprotocol/server`, `legacy: 'reject'`. The user is the token's `sub`, passed through
`authInfo.extra.userId`.

Write a module's tools in `src/infra/mcp/tools/<module>.tool.ts`. A tool resolves a use case and calls
`execute()`, exactly as a route handler does. Take its input schema from the module's `dto/`, and pass its
result through the module's output schema with `.parse()` before returning it.

Keep the authorization server in the `oauth` module and `oauth.controller.ts`, following MCP's 2026-07-28
authorization profile:

- Publish protected resource metadata (RFC 9728) at `/.well-known/oauth-protected-resource/api/mcp` and at the
  root, and server metadata (RFC 8414) at `/.well-known/oauth-authorization-server`.
- Identify a client by its metadata document (CIMD) only. Do not enable dynamic client registration.
- Check the client and its redirect URI, by exact match, before any error may be redirected.
- Require PKCE with `S256`, and a `resource` equal to `mcpResource(env)`, which becomes the token's audience.
- Send the browser to the web app's `/consent`. Show the client's name, the host of its `client_id` and the
  host of its redirect URI, and warn when that redirect returns to this device.
- Return the code with `iss` (RFC 9207), and spend it once: a code presented twice revokes the session its
  first exchange started.
- Rotate refresh tokens, and accept one only from the client it was issued to.
- Fetch a metadata document over https only, at most 5 KB and 5 seconds, following no redirect, and never from
  a private, loopback or link-local address, checked at the connection's own lookup.

## Rationale

MCP is a second edge of the product, beside HTTP, so it reaches the domain the same way: through use cases,
with the user's identity as an argument. A tool that queried a repository would bypass the rules a route
obeys.

`.parse()` is required here and not in a route because Fastify drops a field the response schema does not
list and MCP does not: a tool returns whatever it is handed, so an entity passed straight through publishes
every column.

The audience keeps the two kinds of token apart. A token a client obtained for MCP cannot call the API's own
routes, and the web's own token cannot call MCP.

The client chooses the URL the server fetches, which is what makes CIMD a server-side request forgery risk:
without the address check, a client could make the API read its own network. The check runs at the
connection's lookup, so a name that resolves differently a second time cannot slip past it, and a literal
address is checked before connecting because no lookup happens for one.

**What this costs:** no scopes. A tool acts with everything the user may do, and adding scopes is a change to
this module and to the consent page.

## Applies to

`src/infra/mcp/`, `mcp.controller.ts`, `oauth.controller.ts`, `src/domain/oauth/`, `src/infra/oauth/`, and the
web app's `/consent` route.

## Examples

```
✅  async () => asResult(await container.resolve(FindProfileUseCase).execute(userId))
❌  async () => ({ structuredContent: await em.findOne(Profile, { userId }) })

✅  structuredContent: profileResponseSchema.parse(profile)
❌  structuredContent: profile                       every column leaves

✅  redirectUris.includes(redirectUri)
❌  redirectUri.startsWith(registeredOrigin)
```

## Enforcement

**Tests.** `mcp.controller.spec.ts` walks discovery from the 401, the authorization, consent and the token, then
connects the SDK's own client and asserts a tool returns only the public fields. It also refuses an unknown
client without redirecting, a missing or plain PKCE, another resource, a wrong verifier, a code spent twice,
another client's refresh token, and each token where the other belongs. `https-client-metadata.adapter.spec.ts`
refuses non-canonical client ids and private addresses.

**Review only.** That a new tool goes through a use case and parses its output.
