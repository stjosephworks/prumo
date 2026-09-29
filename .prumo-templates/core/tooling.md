# Tooling

## Rule

Configure TypeScript with `module` and `moduleResolution` both `nodenext`, `target` `ES2023`, `strict` on,
`strictPropertyInitialization` off.

Add `noUncheckedIndexedAccess`. Do not add `exactOptionalPropertyTypes`.

Use `bundler` for `moduleResolution` in a client app (`web`, `mobile`, `site`) where a bundler resolves
modules.

Run Biome's recommended preset, configured in `biome.jsonc`. Write a one-line reason in the configuration
for any rule added or disabled.

In `api`, enable `experimentalDecorators` and `emitDecoratorMetadata`, enable Biome's
`javascript.parser.unsafeParameterDecoratorsEnabled`, turn `style.useImportType` off, and turn
`performance.noBarrelFile` on. Run TypeScript through SWC: `@swc-node/register` in development,
`unplugin-swc` in tests, `@swc/cli` for the build. Never `tsx`.

In a client using shadcn, turn `a11y.noLabelWithoutControl` and `a11y.useSemanticElements` off for
`components/ui/` only, through an override. Keep both on everywhere else.

**Never import a class with `import type` where tsyringe reads its type at runtime**: a constructor
dependency injected without `@inject`.

Run `biome check --staged --write` in `.githooks/pre-commit`. Run `tsc --noEmit` in `.githooks/pre-push`.
Wire both with `"prepare": "node .githooks/install.mjs"`, which sets `core.hooksPath` inside a Git repository,
does nothing outside one, and fails when Git is present and the setting cannot be written.

## Rationale

`nodenext` is one of the three values MikroORM v7 accepts, and it is what Node itself resolves.

`strictPropertyInitialization` is off because an entity's columns are filled by hydration or by the
database, not by its constructor, so the flag reports an error about something correct. The cost is real
and wider than entities: with it off, **any** class may declare a property that is never assigned and the
compiler stays quiet.

`noUncheckedIndexedAccess` is added because `rows[0]` treated as present is the most common source of a
runtime `undefined`. `exactOptionalPropertyTypes` is left out because it is the one strictness flag whose
friction lands in library types rather than in your own code.

**The hooks are split by cost.** Most of this project's guarantees are compiler guarantees, so a hook that
only formats lets through the class of error the rules most rely on. But `tsc` takes five to thirty
seconds, and a slow hook is one somebody bypasses with `--no-verify`, after which Biome does not run
either. Formatting is instant and belongs on every commit; type checking needs to run before code leaves
the machine, which is what pre-push is.

`biome.jsonc` rather than `biome.json`, because the reason has to live beside the rule and JSON cannot hold
a comment.

**Biome cannot parse the API without the parser option.** `@inject(TOKEN)` on a constructor parameter
belongs to the legacy decorator proposal, and Biome reports every one as a syntax error, not a lint warning,
until the option is on.

**`useImportType` breaks injection, and nothing reports it.** tsyringe resolves a dependency injected by
class from the type the compiler emits into the constructor's metadata. `import type` is erased from the
output, so the emitted type becomes `Object`, and resolving the class fails with *TypeInfo not known for
"Object"*. It type-checks, and because a use case is resolved per request, it fails on the first request to
that route rather than at boot. The rule's autofix would make that rewrite across the codebase in one pass,
and written by hand the same `import type` does the same damage, which is why the rule forbids the import and
not only the lint rule.

**SWC and never `tsx`** because tsyringe needs the decorator metadata, and esbuild, which `tsx` runs on, does
not emit it: a class injected by type fails in development only, while build and tests pass. SWC is the one
transformer that emits it in all three places, and `tsc` only checks types.

**The shadcn override is scoped because both rules are right in application code.** A generated `Label`
receives `htmlFor` through props the rule cannot see, and shadcn's `Field` uses `role="group"` deliberately.
Turning them off project-wide would remove the protection from the screens, where a label without a control is
a real defect.

**The hooks are wired by a script, not by `git config` directly,** because `prepare` runs on every install and
`git config` exits 128 outside a repository: an install inside a container, or from an archive, failed outright. A
shell guard was refused: pnpm runs scripts in the system shell, which on Windows is `cmd`, and `|| true` would also
swallow the real failure of a repository that could not be configured.

A short lint configuration is one somebody reads before disagreeing with it. The written reason stops
nobody from adjusting and guarantees the configuration explains itself a year later.

## Applies to

Every project, of every type. Client apps differ only in `moduleResolution`.

## Examples

Configuration changes:

```
✅  // disabled: our DTOs are validated at runtime, not constructed
    "noUnusedVariables": "off"
❌  "noUnusedVariables": "off"
```

Importing what tsyringe reads at runtime:

```
✅  import { EntityManager } from '@mikro-orm/postgresql'
❌  import type { EntityManager } from '@mikro-orm/postgresql'   // TypeInfo not known for "Object"
```

Reading an array:

```
✅  const first = rows[0]; if (!first) return
❌  const first = rows[0]!
```

## Enforcement

**Compiler.** `strict` and `noUncheckedIndexedAccess` are enforced on every build and by the pre-push hook.

**The hooks.** Formatting cannot reach a commit unformatted, and a type error cannot reach the remote,
unless somebody uses `--no-verify`, or never ran an install and so never got `core.hooksPath` configured.

**Route tests.** A constructor dependency imported as a type fails the first request that resolves it, so a
route test covering that use case catches it. A use case tested only through its fake does not.

**Review only.** That a disabled rule carries its reason, and that `strictPropertyInitialization` being
off did not leave an uninitialised property somewhere outside an entity.
