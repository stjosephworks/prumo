# Data

## Rule

Keep the wire contract with the project's API in `src/api-contract/`: `createClient`, which builds every URL
including the `/api/v1` prefix, the `ApiError`, the hand-written request and response types, the query
factories, and `createAuthClient` with `sessionQuery`. **Let the app inject the transport**
(`createClient({ baseUrl, fetch })`) with `credentials: 'include'` on the web configured there, once. In a
monorepo the same directory is `packages/api-contract`.

Build the auth client once, and give the API client its `fetch`: `createClient({ baseUrl, fetch: auth.fetch })`.
That fetch refreshes once on a 401 and repeats the request, with one refresh for every request refused at
once. The web passes no token store and lives on its cookies. `mobile` passes a `TokenStore` over
`expo-secure-store`, which makes the client ask for bearer tokens and send them.

Declare request and response types by hand, in `api-contract/`. Do not generate a client
from the OpenAPI document, and **do not `import type` an entity from the API package**; see below.

Give every query a factory in `api-contract/`, taking the client and returning the whole options object so the key and the fetch
function travel together. Include in the key everything that changes the result: filters, cursor,
ordering.

Let the client parse every `application/problem+json` body into one `ApiError` carrying `status`,
`title`, `detail`, `requestId` and the `errors` map, and throw it. The auth routes answer the same way. No
component reads a raw error body.

Use `useInfiniteQuery` for paginated lists, with `getNextPageParam` returning `nextCursor`, or `undefined`
once it is null.

Invalidate explicitly in each mutation's `onSuccess`, building the key from the same factory. Never
invalidate everything.

## Rationale

Types are written by hand because generated ones arrive as deeply nested `paths[…][…][…]` shapes that
every project then wraps in aliases to make usable. The cost accepted in exchange is real and silent: the
API renames a field, the client keeps compiling against its own copy, and the failure appears as
`undefined` on a screen.

**Importing the entity type from the API package looks like the obvious fix and is unsound.** Responses
pass through the route's output schema, which drops every field it does not list, so a property can remain
on the entity type while missing from the JSON; and a `Date` on the entity arrives as an ISO string. The
shared type would promise `tenantId` on a payload that never carries it: a type that lies, which is worse
than the duplication it removes.

**The contract lives in one directory, not beside each feature, so that one template serves both
architectures.** The monorepo form moves `api-contract/` whole into `packages/api-contract` and changes one
import prefix. Scattered across features, the same code would need gathering at copy time, or a second copy
of it. It also mirrors the API: every wire shape in one place, so a renamed field has one file to fix. **What it
costs:** a project that stays `alone` passes its transport as a parameter it never varies.

The query factory settles by construction what would otherwise be discipline. Wherever something
prefetches and something else reads (a route loader on the web, a screen preloading the next one) a
difference between their keys fills one cache entry while the other is read, paying twice and gaining
nothing, with no warning. A key that omits a filter is the same class of fault: two screens share one
entry and the second shows the first's data.

**The auth client is the one door every request goes through.** An access token lasts fifteen minutes, so any
request can meet a 401 that a refresh would answer. Doing that once, in the transport, means no screen knows
tokens expire. Several requests refused together share one refresh, because a second would present a token the
first has already rotated, and the API would read that as theft.

One `ApiError` keeps the shape of problem+json in a single file instead of in every component that
displays an error. It also puts `requestId` on every failure without anyone asking, which is what makes a
500 that reveals nothing supportable: the user opening a ticket arrives with the identifier that finds the
log line.

Invalidating everything is never wrong and makes a screen with six queries fire six requests on any save,
which reads as an application that is slow for no reason.

## Applies to

Every client (`web`, `mobile` and `site`) for every call to the API.

The TanStack Query rules apply where Query is used, which is `web` and `mobile`. A `site` fetching on the
server uses the wrapper, the hand-written types and the `ApiError`, and not the query factory or
`useInfiniteQuery`.

## Examples

The query factory:

```
✅  export const ordersQuery = (filters) => ({ queryKey: ['orders', filters], queryFn: … })
    // every caller builds the key the same way
❌  prefetch:  queryKey: ['orders']
    component: queryKey: ['orders', filters]
```

Reaching the server:

```
✅  createClient({ baseUrl, fetch: auth.fetch })     // refreshed and repeated on a 401
❌  createClient({ baseUrl, fetch })                 // the first expired token signs the user out
```

Reading an error:

```
✅  catch (e: ApiError) { form.setErrors(e.errors); toast(e.title, e.requestId) }
❌  catch (e) { const body = await e.response.json(); body['errors'] }
```

Invalidating:

```
✅  onSuccess: () => qc.invalidateQueries({ queryKey: ordersQuery().queryKey })
❌  onSuccess: () => qc.invalidateQueries()
```

## Enforcement

**Structural.** The key and the fetch function cannot disagree, because the factory returns both. The
error shape is parsed in one place, so no component can depend on the wire format.

**Review only, and two of these fail silently:**

That a hand-written type still matches what the API returns. Nothing checks it, and the divergence appears
as `undefined` at runtime. This is the known cost of not generating the client.

That a query key includes every filter that changes the result.

That a mutation touching two resources invalidates both. Forgetting one leaves that screen stale.
