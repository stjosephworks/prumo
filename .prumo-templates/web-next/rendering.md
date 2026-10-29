# Rendering and data

## Rule

Use the App Router. Do not use the Pages Router, and do not mix the two.

Keep every route static by default. Use revalidation where content changes without a deploy. Make a route
dynamic only when the response depends on who asked, and write one comment line saying why.

Split every page by who it is for:

- **A public page** fetches its data on the server, in a Server Component or the static generation function, and
  passes it to client components as props. Do not call the API from the browser to render it.
- **The signed-in area** lives under `app/[locale]/(signed-in)/`, whose layout holds `<SignedIn>`. Its pages render client
  components that fetch in the browser, through TanStack Query and the API contract, with the clients from
  `useClients()`.

Treat calls from the app's server as anonymous. They carry no user cookie. Never read the session on the server.

Read search params in the browser, with `useSearchParams` inside a `<Suspense>`, so a page that takes them stays
static.

**Before writing Next code, read the guide for the installed version in `node_modules/next/dist/docs/`.** It wins over
anything remembered. Keep `agentRules: false` in `next.config.ts`.

## Rationale

Next is the framework chosen for an app that needs search engines, so a public page that does not arrive rendered
defeats it. Fetching its content through `useQuery` would leave the generated HTML empty and show the crawler a
shell.

**The signed-in area runs in the browser because that is where the session is.** The API sets its cookies for its
own origin, and the browser sends them on its own; the server that renders the page never sees them. Rendering a
signed-in page on the server would mean proxying the API through this app, a second cookie model and a refresh on
the server, for pages no search engine reads. In the browser the signed-in area is the Vite app's, with the same
contract, the same forms and the same tests.

**The default must be static because in the App Router a route becomes dynamic by accident.** Reading a
cookie, a header or a search param inside a Server Component switches the whole route to per-request
rendering, with no error and no warning: a page that was instant starts waiting on a server. With a static
default that is a departure from a written rule and shows up in review; with a dynamic default nobody
notices. Reading search params in the browser is what keeps sign-in and consent static while they take a
`redirect` or a `request`.

Making everything static forever breaks the first time somebody wants to publish a paragraph without
calling a developer, which is what revalidation is for. Making everything dynamic inverts the cost: a page
that rarely changes would pay for a server on every visit, including the crawler's, and crawlers visit often.

**The installed documentation wins because Next says its own APIs moved.** Next 16 ships its guides inside the package
and, when `next dev` detects an AI coding agent, writes a block into `AGENTS.md` telling it to read them, creating
`AGENTS.md` and `CLAUDE.md` where none exist, which in a workspace means inside the app's directory, beside the
root's. The advice is kept here, where every other rule lives, and the automatic write is turned off so no second
context file appears on its own.

## Applies to

Every route under `app/`.

**This area uses all of `client/data.md` in the signed-in area**, and the wire contract (base URL, `/api/v1`, the
hand-written types, the `ApiError`) on a public page too. The TanStack Query conventions do not apply on the server:
there is no client-side cache there to key, invalidate or paginate.

## Examples

Where a fetch happens:

```
✅  // app/posts/page.tsx: a Server Component, public data
    const posts = await getPosts()
✅  // features/orders/orders.tsx, rendered under app/[locale]/(signed-in)/
    const { data } = useQuery(ordersQuery(api))
❌  // app/posts/page.tsx
    'use client'
    const { data } = useQuery(postsQuery())
❌  // a Server Component under app/[locale]/(signed-in)/: the server has no session
    const me = await api.get<Profile>('/users/me')
```

Going dynamic:

```
✅  // dynamic: the response depends on the visitor's country header
❌  const country = headers().get('x-country')     // no comment, whole route now dynamic
```

## Enforcement

**Review only, and this is the line that matters: nothing warns when a route slips into being dynamic.**
The clue is indirect: somebody added a cookie or header read three components down, and the page quietly
stopped being static. The symptom is latency, not an error. `next build` marks each route; every route of the
template is `○`, static.

Also review: that no public page renders its content from a browser fetch, that nothing under `(signed-in)` fetches
on the server, and that a dynamic route carries its reason.

**Worth knowing:** most written material about Next describes the Pages Router, so an assistant without
this document mixes `getServerSideProps` with Server Components. They do not compose.
