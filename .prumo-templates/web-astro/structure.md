# Structure

## Rule

Keep a page's content in its own file under `src/pages/`: the HTML, the title and description it passes to its
layout, and the islands it mounts. **Do not push a page's content into a feature.**

Organise what is interactive by feature, in `features/<name>/`: the React components, and the island a page mounts,
exported from the same file as the component it wraps.

Put shared code in one of five places and nowhere else:

- `components/ui/`: shadcn primitives, where its CLI installs them
- `layouts/`: the `.astro` shells pages share
- `api-contract/`: the wire contract with the API, as `client/data.md` describes
- `lib/`: pure functions, with no state and no React
- a named feature: anything with behaviour

Do not create a `shared/` or `common/` folder. Name every file in kebab-case, `.astro` files included.

Style with Tailwind and shadcn/ui, in `.astro` files as in React. Express variants with `cva`, and use a primitive's
variants (`buttonVariants`) for plain HTML.

Resolve `@/` to the app's own `src/`.

## Rationale

A page is what a search engine reads, so its text, title and description belong together, and the `.astro` file is
the only place that holds all three. That is why this area, like Next's, keeps content in the route file, where Vite
and mobile keep thin routes pointing at features.

An island is exported beside the component it wraps so a page imports one name, and the feature's component stays
testable on its own. Everything else carries over from Vite's area, `web-vite/structure.md`, for the reasons given
there: a `shared/` folder has no admission criterion, so it only grows.

kebab-case for `.astro` files too, although Astro's examples use PascalCase, because the conventions name every
source file that way, and a case-only rename does not register on macOS or Windows.

## Applies to

Every file under `src/`.

## Examples

Where a page lives:

```
✅  src/pages/pricing.astro      → the content, its metadata and its islands
❌  src/pages/pricing.astro      → renders <Pricing client:only="react" /> holding the whole page
```

Shared code:

```
✅  layouts/narrow.astro
    lib/navigate.ts
❌  components/Header.astro      → layouts/ or a feature, in kebab-case
```

## Enforcement

**Review only.** That a page's text is in its `.astro` file, that no `shared/` folder appeared, and that a third
repetition was extracted.
