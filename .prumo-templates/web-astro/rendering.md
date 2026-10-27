# Rendering and islands

## Rule

Build every page ahead of time, which is Astro's default. Keep a public page free of JavaScript: its content is
HTML written in the `.astro` file, from data fetched in its frontmatter at build time.

Make a part interactive as a React island, mounted with `client:only="react"`. Build every island with `island()`
from `features/clients/island.tsx`, which gives it the API clients and a query cache, and with `{ signedIn: true }`
waits for the session and sends a visitor without one to sign in.

Fetch what depends on the user inside an island, in the browser, through TanStack Query and the API contract. Never
call the API as a user from a page's frontmatter: the build has no user.

Navigate between pages with a plain link or `navigate.to()` from `lib/navigate.ts`. Each page is a new page load.

Render a page per request only when it must, by adding an adapter such as `@astrojs/node` and
`export const prerender = false` on that page, with one comment line saying why.

**Before writing Astro code, read the guide for the installed version at docs.astro.build.** It wins over anything
remembered.

## Rationale

This framework is chosen for pages that are read more than used: a search engine and a reader both get finished
HTML, and the only JavaScript sent is the islands'. A public page that renders its content in an island has thrown
that away, and an assistant used to React writes exactly that.

The API's cookies live in the browser, so only the browser can ask the API as the user. The build that renders the
pages runs once, as nobody: a page that reads a session in its frontmatter gets none, and with on-demand rendering it
would still not see cookies set for the API's own domain.

`client:only` because an island in the signed-in area has nothing to show before the browser knows the session, and
one rendered on the server would show a page to a visitor who is about to be sent away. Every island is one React
root of its own, and navigating loads the next page, so each one brings its clients rather than sharing a cache.

Static by default because it needs no server at all, and a page that turns dynamic gains a server to run and a reason
to state.

## Applies to

Every file under `src/pages/` and `src/layouts/`, and every island.

**This area uses all of `client/data.md` inside an island**, and the wire contract (base URL, `/api/v1`, hand-written
types, the `ApiError`) in a page's frontmatter too.

## Examples

Where a fetch happens:

```
✅  // src/pages/posts.astro, frontmatter: public data, at build time
    const posts = await api.get<Post[]>('/posts')
✅  // an island: what belongs to the signed-in user
    const { data } = useQuery(ordersQuery(api))
❌  // frontmatter: there is no user at build time
    const me = await api.get<Profile>('/users/me')
```

An island:

```
✅  export const Orders = island(OrdersPart, { signedIn: true })
    <Orders client:only="react" />
❌  <OrdersPart client:load />          // no clients, no guard, rendered on the server
```

## Enforcement

**Review only.** That a public page ships no island it does not need, that no frontmatter asks the API as a user,
that every island comes from `island()`, and that a page rendered on demand says why. `verify.mjs` in Prumo's own CI
checks that the generated home page carries its metadata and hydrates nothing.
