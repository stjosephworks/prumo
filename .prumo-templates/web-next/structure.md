# Structure

## Rule

Organise by feature. Put what is reused across routes in `features/<name>/`.

Keep a route's content in its own `page.tsx` or `layout.tsx`, alongside its `generateMetadata` and
`generateStaticParams`. **Do not push a page's content into a feature.**

Put shared code in one of four places and nowhere else:

- `components/ui/`: shadcn primitives, where its CLI installs them
- `api-contract/`: the wire contract with the API, as `client/data.md` describes, once a page calls the API
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

That is why this area departs from `web` and `mobile`, which both keep thin route files pointing at
features. The departure is not preference: only in the App Router does a route file carry SEO metadata,
and that is precisely what distinguishes this type.

Everything else carries over from the web area for the reasons given there. A `shared/` folder has no
admission criterion, so it only grows; not everything shared is a component, and a formatting helper is a
function in a file. shadcn's plumbing (`cn()`, `cva`, the theme tokens) is used from the first
hand-written component onward, whether or not any component is installed, which is why it is here even on
a site with four screens.

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

**An asymmetry worth knowing:** `web` and `mobile` keep route files thin and push screens into features.
This area does the opposite, and only for the metadata reason above. It is deliberate rather than an
inconsistency to tidy up.
