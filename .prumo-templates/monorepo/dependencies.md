# Dependencies

## Rule

Declare every external dependency's version once, in the catalog. Reference it as `catalog:` in each
`package.json`.

Where two apps genuinely need different majors of one package, put the odd one in a **named** catalog and reference
it as `catalog:<name>`. Name the catalog after the version it holds (`tailwind3`), and write beside it the condition
that removes it.

Depend on a workspace package with `workspace:*`.

Declare in each package every dependency that package imports. Keep the root `package.json` for workspace
tooling only: nothing application code imports.

Let an app depend on packages. **Never let an app depend on another app**, not even for a type.

Never let a package depend on an app.

## Rationale

One catalog entry per dependency means *which version of X do we use* has a single place to look, with no
exception to check first. Restricting the catalog to what more than one package uses would require a
judgement that ages: when a second package adopts something, somebody has to remember to move the version,
nothing prompts them, and the project ends up running two versions of one library until one breaks.

A named catalog is the one exception, and it is visible by construction: it has a name, it sits in one file, and
every other conflict still fails. It exists because the stable NativeWind requires Tailwind 3 while the web uses
Tailwind 4; refusing any exception would have made a workspace holding both web and mobile impossible to generate.

`workspace:*` rather than a range, because nothing here is published. A range on an internal package would
describe a choice that does not exist; `*` states what is true: the copy sitting next to it.

Declaring per package is what keeps **phantom dependencies** out. With `react` only at the root, an app
imports it and works without declaring it, harmless until somebody extracts that app, or removes `react`
elsewhere, and an import breaks with nothing having changed. The repetition this seems to cost is not real:
every entry is the identical line `"react": "catalog:"`, not a version to keep in sync.

An app depending on another app is tempting (importing a type from the API looks like the way to stop
duplicating the contract), and it is wrong twice. **The type is the wrong one:** a response passes through
the route's output schema, which drops every field it does not list, so a property can be present on the
type and absent from the JSON, promising fields the payload never carries. **And an app is deployable:** the dependency means
building one requires the other, CI needs both for either, and the boundary between two things with
separate lifecycles stops existing.

`import type` does not rescue it. It is erased at runtime and needed everywhere else (by `tsc`, by the
editor, by CI), and nothing stops somebody swapping it for a value import when the type later becomes a
constant.

If two apps need the same thing, it belongs in the package.

## Applies to

Every `package.json` in the workspace, and the catalog.

## Examples

Declaring:

```
✅  "react": "catalog:"            "@app/api-contract": "workspace:*"
❌  "react": "^19.0.0"             "@app/api-contract": "^1.0.0"
```

Direction:

```
✅  apps/web  → packages/api-contract
❌  apps/web  → apps/api
❌  apps/web  → import type { User } from '../../api/src/…'
```

## Enforcement

**The installer.** pnpm's strict isolation rejects importing what a package did not declare, in every
workspace, including one holding `mobile`. Expo does **not** need `nodeLinker: hoisted`: a workspace with `api`,
`web` and `mobile` on the default isolated linker bundles iOS and Android, verified with Expo SDK 57.

**One import nobody writes still counts.** NativeWind's Babel JSX runtime injects `react-native-css-interop` into
the app's source, so the app declares that package; without the declaration the bundle fails to resolve it.

**Review only.** That no app imports from another app, and that the root `package.json` gained nothing an
app imports.
