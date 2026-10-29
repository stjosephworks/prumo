# Structure

## Rule

Organise by feature. Put what is reused across routes in `features/<name>/`.

Keep a route's content in its own `page.tsx` or `layout.tsx`, alongside its `generateMetadata` and
`generateStaticParams`. **Do not push a page's content into a feature.**

Group routes by who they are for: `app/[locale]/(auth)/` for sign-in and its neighbours, `app/[locale]/(signed-in)/` for what needs a
session, and the public pages at the top. A feature a page renders interactively exports the small client component
the page uses, beside the form or list it wraps, reading the clients from `useClients()` and the search params from
`useSearchParams()`.

Put shared code in one of four places and nowhere else:

- `components/ui/`: shadcn primitives, where its CLI installs them
- `api-contract/`: the wire contract with the API, as `client/data.md` describes
- `lib/`: pure functions, with no state and no React
- a named feature: anything with behaviour

Do not create a `shared/` or `common/` folder.

Style with Tailwind and shadcn/ui. Express variants with `cva`. Extract a repeated class list on its third
occurrence, as a component.

Resolve `@/` to the app's own `src/`.

## Rationale

**Metadata is part of a page's content, not of its navigation.** A title, a description and a share image
describe that specific text, so separating them makes it easy to change one without the other, and a page
with the wrong title is a defect that surfaces only when somebody shares the link.

That is why this area departs from Vite and mobile, which both keep thin route files pointing at
features. The departure is not preference: only in the App Router does a route file carry SEO metadata,
and that is precisely why a web app is built on Next.

The forms keep the props they take on Vite, and only the small component beside them knows about Next. That keeps a
form the same file in both templates, so a fix to one is a copy to the other.

Everything else carries over from Vite's area, `web-vite/structure.md`, for the reasons given there. A `shared/`
folder has no admission criterion, so it only grows; not everything shared is a component, and a formatting helper
is a function in a file. shadcn's plumbing (`cn()`, `cva`, the theme tokens) is used from the first hand-written
component onward, which is why it is here even on an app with four screens.

## Applies to

Every file under `src/` and `app/`.

## Examples

Where a page lives:

```
✅  app/pricing/page.tsx        → the content and generateMetadata together
❌  app/pricing/page.tsx        → renders <PricingPage/> from features/pricing
```

Shared code:

```
✅  features/newsletter/         // reused on three routes
    lib/format-date.ts
❌  shared/components/cta.tsx
```

## Enforcement

**Review only.** That a page's metadata sits with its content, that no `shared/` folder appeared, and that
a third repetition was extracted.

**An asymmetry worth knowing:** Vite and mobile keep route files thin and push screens into features.
This area does the opposite, and only for the metadata reason above. It is deliberate rather than an
inconsistency to tidy up.
