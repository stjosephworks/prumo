# Structure

## Rule

Organise by feature. Put a feature's components, hooks and queries together in `features/<name>/`. Keep
`routes/` for thin route definitions that point at features.

**Do not organise by type.** There is no root `components/`, `hooks/` or `pages/` holding every
feature's files.

Put shared code in one of four places and nowhere else:

- `components/ui/`: shadcn primitives, where its CLI installs them
- `api-contract/`: the wire contract with the API, as `client/data.md` describes
- `lib/`: pure functions, with no state and no React
- a named feature: anything with behaviour

Do not create a `shared/` or `common/` folder.

Keep client state in React context, one context per subject, living in the feature that owns it. Do not
create a single application context.

Resolve `@/` to the app's own `src/`.

## Rationale

Feature-first is the same axis the API uses for modules, so *where do I go to change orders* has one
answer at both ends of the project. A change then touches one folder instead of five. Organising by type
optimises for *show me every hook*, which nobody asks; organising by feature optimises for *change this
feature*, which is every task. This rule is written negatively because `components/`, `hooks/`, `pages/`
is the layout of nearly every React tutorial and therefore the default an assistant reaches for.

`components/ui/` is not a preference: the shadcn CLI installs there, and moving it would mean editing
every install afterwards.

A `shared/` folder has no admission criterion: *is this shared?* answers yes for anything used twice, so
it only grows. Requiring a name forces the question *what is this*, and something nobody can name is not
ready to be promoted. Not everything shared is a component, either: formatting a date is a function in a
file. **If it uses React, it does not belong in `lib/`.**

One context per subject exists because context re-renders **every** consumer when its value changes. A
context bundling theme, sidebar and current user makes a theme toggle re-render the whole tree: invisible
with three components, expensive when the screen grows, and never an error.

## Applies to

Every file under `src/`.

## Examples

Where a feature's code lives:

```
✅  features/orders/order-list.tsx
    features/orders/use-orders.ts
    routes/orders.tsx            → renders features/orders

❌  components/orders/order-list.tsx
    hooks/use-orders.ts
    pages/orders.tsx
```

Shared code:

```
✅  lib/format-currency.ts          // pure
    features/notifications/         // has behaviour, has a name
❌  shared/utils.ts
    shared/hooks/use-notifications.ts
```

Context:

```
✅  features/theme/theme-context.tsx
❌  app-context.tsx                 // theme + sidebar + user
```

## Enforcement

**Review only.** Nothing prevents a root `components/` folder from appearing, or a `shared/` from being
created, or two contexts from being merged into one for tidiness.

**Two things worth knowing rather than discovering:**

Zustand was deliberately left out because TanStack Query owns server state and what remains is usually
context-sized. If a project accumulates real client state and contexts start multiplying or re-rendering
too widely, Zustand is the right answer again and installing it costs nothing. Context is not claimed to
scale indefinitely.

In a monorepo, `@/` means something different in each app, so a file moved between apps can compile while
pointing somewhere else.
