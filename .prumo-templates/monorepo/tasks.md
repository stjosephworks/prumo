# Tasks and configuration

## Rule

Give the root `package.json` a `dev` script that starts every app with `pnpm -r --parallel dev`, and one script
per app, named after it, that starts only that app with `pnpm --filter <app> dev`. Give it `lint`, `typecheck`
and `test` as well, each running through `pnpm -r`.

**Every app answers to `dev`.** When a framework names its development command differently, keep its name and
alias it: `"dev": "pnpm start:dev"` in the API, `"dev": "pnpm start"` in mobile.

**Give every app its own port.** The API holds 3000, so the site runs on 3200.

Keep compiler options in `tsconfig.base.json` at the workspace root. Extend it by relative path from each
app and package, overriding only what differs.

Do not use project references.

Keep Biome's shared settings (formatter and preset) in `biome.jsonc` at the root. Give each app that needs more
its own `biome.jsonc` with `"extends": "//"`, holding only what differs.

## Rationale

`pnpm -r` runs in topological order, so the orchestration usually credited to a task runner already exists.
What does not exist is caching, and caching pays once a build hurts, which a freshly generated workspace
does not.

`pnpm dev` is safe because the one-app command is just as short. Without `pnpm web` beside it, typing
`pnpm dev` while expecting the app you work on would start four processes; with it, starting everything is a
choice rather than an accident. The root scripts call `dev` and nothing else, which is why every app answers to
that name: the root never needs to know how each framework spells its development command.

**Mobile gives up its terminal under `pnpm dev`.** Metro starts and serves, so an open simulator connects, but
the QR code, the URL a device opens and the keyboard shortcuts appear only when Expo owns the terminal. When you need
them, run `pnpm mobile` in a terminal of its own.

Ports are fixed per app because `pnpm dev` starts them together, and a collision there fails only when two apps
run at once: `next dev` defaults to 3000, which the API already holds.

The other three belong at the root because that is what the pre-push hook calls. Leaving them out would
mean each person assembling their own `--filter`, and several versions of one command.

A single base config keeps five files from starting identical and diverging silently: one gains a flag,
another does not, and nobody notices until behaviour differs between apps. It is a root file rather than a
package because turning configuration into a package adds a `package.json`, a workspace entry and a
declared dependency in order to deliver one JSON file.

Biome follows the same shape because the two apps genuinely differ (decorator parsing in `api`, the shadcn
exceptions in `web`) while formatting and the preset must not. `"extends": "//"` is Biome's own syntax for
*inherit from the root, wherever it is*, and running `biome` from the root respects every nested file. One
configuration with per-directory overrides was refused because every new app would edit the shared file, and
because composing it would mean merging JSON rather than moving a file.

**Project references are refused for the same reason the shared package ships source:** they need
`composite: true` and produce a build order with intermediate artefacts, which brings back the failure of
changing something and not seeing the effect.

## Applies to

The workspace root, and every `tsconfig.json` beneath it.

## Examples

Starting work:

```
✅  pnpm web                    // the app you are working on
✅  pnpm dev                    // every app; mobile without its QR code
✅  pnpm mobile                 // mobile with its QR code and shortcuts
❌  "dev" missing from an app   // pnpm dev silently skips it
```

Extending the base:

```
✅  { "extends": "../../tsconfig.base.json", "compilerOptions": { "jsx": "react-jsx" } }
❌  a complete compilerOptions block per app
```

## Enforcement

**The hook.** Pre-push runs the root `typecheck`, so a type error in any package stops the push.

**Review only.** That a new app extends the base rather than copying it, answers to `dev`, runs on a port no
other app uses, and has a root script named after it. A missing `dev` fails nothing: `pnpm -r` skips a package
without the script, so the app simply does not start.

**The reversal condition, stated so it is measurable rather than a feeling:** without caching,
`pnpm -r typecheck` runs `tsc` in every package from scratch every time. Turborepo belongs on the table the
day that becomes annoying enough for somebody to stop running it before pushing, not when the repository
merely feels large.
