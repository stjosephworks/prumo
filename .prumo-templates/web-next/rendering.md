# Rendering and data

## Rule

Use the App Router. Do not use the Pages Router, and do not mix the two.

Keep every route static by default. Use revalidation where content changes without a deploy. Make a route
dynamic only when the response depends on who asked, and write one comment line saying why.

Fetch data on the server: in a Server Component or in the static generation function. Pass it to client
components as props.

Do not call the API from the browser to render a page. A browser call exists only for interaction after
load, such as submitting a form.

Treat calls from the site's server as anonymous. They carry no user cookie.

**Before writing Next code, read the guide for the installed version in `node_modules/next/dist/docs/`.** It wins over
anything remembered. Keep `agentRules: false` in `next.config.ts`.

## Rationale

This type exists because of SEO, so a page that does not arrive rendered defeats it. Fetching through
`useQuery` would leave the generated HTML empty and show the crawler a shell, and then there was no
reason to separate `site` from `web` at all.

**The default must be static because in the App Router a route becomes dynamic by accident.** Reading a
cookie, a header or a search param inside a Server Component switches the whole route to per-request
rendering, with no error and no warning: a page that was instant starts waiting on a server. With a static
default that is a departure from a written rule and shows up in review; with a dynamic default nobody
notices.

Making everything static forever breaks the first time somebody wants to publish a paragraph without
calling a developer, which is what revalidation is for. Making everything dynamic inverts the cost: an
institutional page that rarely changes would pay for a server on every visit, including the crawler's, and
crawlers visit often.

The site's server has no user, so there is nobody to authenticate as. A page needing authenticated data is
neither static nor public, and probably does not belong to this type.

**The installed documentation wins because Next says its own APIs moved.** Next 16 ships its guides inside the package
and, when `next dev` detects an AI coding agent, writes a block into `AGENTS.md` telling it to read them, creating
`AGENTS.md` and `CLAUDE.md` where none exist, which in a workspace means inside `apps/site`, beside the root's. The
advice is kept here, where every other rule lives, and the automatic write is turned off so no second context file
appears on its own.

## Applies to

Every route under `app/`.

**This area uses half of `client/data.md`.** The wire contract (base URL, `/api/v1`, hand-written types,
the `ApiError`) applies. The TanStack Query conventions do not: there is no client-side cache to key,
invalidate or paginate.

## Examples

Where a fetch happens:

```
✅  // app/posts/page.tsx: a Server Component
    const posts = await getPosts()
❌  'use client'
    const { data } = useQuery(postsQuery())
```

Going dynamic:

```
✅  // dynamic: the response depends on the visitor's country header
❌  const country = headers().get('x-country')     // no comment, whole route now dynamic
```

## Enforcement

**Review only, and this is the line that matters: nothing warns when a route slips into being dynamic.**
The clue is indirect: somebody added a cookie or header read three components down, and the page quietly
stopped being static. The symptom is latency, not an error.

Also review: that no page renders its content from a browser fetch, and that a dynamic route carries its
reason.

**Worth knowing:** most written material about Next describes the Pages Router, so an assistant without
this document mixes `getServerSideProps` with Server Components. They do not compose.
