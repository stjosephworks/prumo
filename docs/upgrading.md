# Upgrading a project

Prumo writes a project once and does not come back to it. There is no `prumo upgrade`, and updating a
project's `.prumo/` in place comes after 1.0. What a later version changed in the files it generates is
listed here, so a team can carry the change over by hand.

The version that generated a project is `prumo` in its `.prumo/config.json`. A config without that field was
written by 0.1.0.

## The method

Generate two reference projects with the same answers, one at the version the project came from and one at
the version you are moving to. The difference between them is what Prumo changed; the difference between the
older one and your project is what your team changed.

1. Read the answers from `.prumo/config.json` and turn each into its flag:

   | Field | Flag |
   |---|---|
   | `types` | `--types api,web` |
   | `apps` | `--app <name>=<type>` for each app whose name is not its type, in order; those types leave `--types` |
   | `architecture` | `--alone` or `--monorepo` |
   | `multiTenant` | `--multi-tenant` or `--single-tenant` |
   | `mcp` | `--mcp` or `--no-mcp` |
   | `email` | `--email` or `--no-email` |
   | `social` | `--social google,apple`, or `--no-social` when it is empty |

   `apps` exists from 0.6.0, and only in a workspace.

   `email` and `social` exist from 0.4.0. A project generated before has neither, so its reference at the old
   version leaves both flags out, and its reference at the new one passes `--no-email --no-social`.

2. Generate both, under the project's own name so that nothing differs by name alone:

   ```sh
   mkdir ../ref-old ../ref-new
   (cd ../ref-old && npx @stjoseph/prumo@0.4.2 new acme --types api,web --monorepo --single-tenant --no-mcp --no-email --no-social --skip-install)
   (cd ../ref-new && npx @stjoseph/prumo@0.5.1 new acme --types api,web --monorepo --single-tenant --no-mcp --no-email --no-social --skip-install)
   ```

3. Diff each file the sections below list:

   ```sh
   git diff --no-index ../ref-old/acme/scripts/ports.mjs ../ref-new/acme/scripts/ports.mjs   # what Prumo changed
   git diff --no-index ../ref-old/acme/scripts/ports.mjs scripts/ports.mjs                   # what your team changed
   ```

   When the second diff is empty, copy the new file over. When it is not, the file is the team's now: apply
   Prumo's change to it by hand, and keep what the team wrote.

**Do not overwrite blindly.** A generated file the team edited carries decisions Prumo knows nothing about,
and copying the new version deletes them without a trace. That holds most of all for `package.json`,
`README.md`, `.env` (whose secret is generated afresh for every project) and the `.prumo/` documents, which
belong to the team from the day they are written.

With `--skip-install` the formatter does not run, so a workspace reference keeps the contract import as the
template writes it. Formatting never touches the files listed here.

## Where a file lands

A path below is given as the project sees it when generated `alone`. In a workspace, each app's files sit under
`apps/<name>/`, the name being the app's type unless it was named on purpose, and the workspace root holds its own
`scripts/ports.mjs`, `.githooks/`, `.gitattributes` and `.github/`: an app inside a workspace has none of the last
three of its own.

## What changed, release by release

### 0.7.0

| File | Types | Change |
|---|---|---|
| `.prumo/core/git.md` | every type | New. The branch flow: `task/`, `fix/`, `chore/`, `docs/`, `refactor/` → `dev` → `staging` → `main`, and large work through `project/` |
| `.prumo/INDEX.md` | every type | Lists `core/git.md` |
| `.github/workflows/flow.yml` | every type, at the root | New. Fails a pull request that skips a step of the flow |
| `.github/rulesets/flow.json`, `.github/rulesets/project.json` | every type, at the root | New. What the README's `gh api` commands send to make the check required |
| `README.md` | every type, at the root | A Branches section with those commands |
| `.githooks/pre-commit` | every type, at the root | `--no-errors-on-unmatched`, so a commit of only files Biome does not check passes |
| `.prumo/core/tooling.md` | every type | Names that flag |

Why: with several people on one project, a large change merged into `dev` early decided what shipped next for
everyone. A `project/` branch holds it, split into tasks, until it is decided to ship. A new project's repository
also starts on `main`, whatever the machine's `init.defaultBranch` says; an existing one renames its branch with
`git branch -m main` if it needs to.

### 0.6.1

Nothing generated changed. Three fixes to `prumo add`, each found once it ran with a real install:

- on Windows it failed after installing, because it passed the new app's path to Biome with backslashes;
- where `CI` is set, pnpm refused to update the lockfile the new app changes;
- a first web app had its origin listed twice in the API's `WEB_ORIGIN`. A project 0.6.0 gave a doubled origin
  works as it is.

### 0.6.0

| File | Types | Change |
|---|---|---|
| `src/infra/config/env.ts` | api | `WEB_ORIGIN` is a comma-separated list of origins, parsed into an array; one origin is a list of one |
| `src/infra/http/hooks/origin.hook.ts`, `src/infra/http/app.ts` | api | The origin check and CORS accept every origin in the list |
| `src/infra/http/controllers/oauth.controller.ts` | api | MCP consent opens on the first origin |
| `src/infra/http/controllers/social.controller.ts` | api | Takes an optional `origin`, refused unless trusted, and sends the web back to it |
| `test/support/setup.ts`, `test/infra/config/env.spec.ts`, two controller specs | api | `WEB_ORIGIN` as an array; new cases for several web apps |
| `.env.example`, `README.md` | api | Say that `WEB_ORIGIN` is a list |
| `src/api-contract/auth.ts`, or `packages/api-contract/src/auth.ts` | web, mobile | `socialSignInUrl` takes an optional `origin` |
| `src/features/auth/social-buttons.tsx` and its spec | web | Pass `window.location.origin` |
| `scripts/ports.mjs` | every type, and the workspace root | Finds the apps through `.prumo/config.json`, and keys its result by app name |
| `.prumo/monorepo/*.md`, `.prumo/api/auth.md`, `.prumo/social/sign-in.md`, `.prumo/mcp/server.md` | workspace, api | Apps named on purpose, and several web apps |
| `src/infra/social/openid-identity-providers.adapter.ts` | api | Without Apple, the `jose` import goes with it |

Why: a workspace may hold apps named on purpose, and more than one web or site, through `prumo new --app
<name>=<type>` or, later, `prumo add <type> [name]`. `prumo add` works only from the version that generated the
project, so a project from before 0.6.0 does not take it. `.prumo/config.json` lists them in `apps`, which a workspace from an older version lacks; without
it, `ports.mjs` reads one app per type, named after it, as before. Nothing else changes for a project that keeps its
default names, and a single `WEB_ORIGIN` keeps working.

### 0.5.1

| File | Types | Change |
|---|---|---|
| `test/support/query-client.ts` | web, mobile | New. `createTestQueryClient()` builds a test's `QueryClient` with `retry: false` and `gcTime: Infinity` |
| Every spec that builds a `QueryClient`, and web's `test/support/render-app.tsx` | web, mobile | Build it with `createTestQueryClient()` instead of `new QueryClient()` |
| `.prumo/core/testing.md` | every type | The rule names the helper instead of the option to remember |

Why: a query or mutation left without an observer starts a five-minute timer, and Jest's worker waits on it until
it is force-exited. 0.4.2 fixed one mobile spec; the helper fixes every test that will be written.

`prumo new` also refuses a name pnpm's compatibility database extends, such as `ws`. Nothing in a project changes,
but a project already named that way installs packages it never asked for: renaming the root `package.json` stops it.

### 0.5.0

| File | Types | Change |
|---|---|---|
| `.gitattributes` | every type, at the root | New. `* text=auto eol=lf` |
| `scripts/ports.mjs` | every type, and the workspace root | Largely rewritten |
| `scripts/database.mjs` | api | Migrates through the shell |
| `README.md` | api, workspace | States the Windows requirements |

Why: Prumo and its projects run natively on Windows from 0.5.0. `.gitattributes` keeps a Windows checkout in LF,
which Biome would otherwise flag in every file. `ports.mjs` finds and stops a port's holders on Windows, and it
also fixes macOS and Linux: an app's processes now stop when what started them is gone, so a Ctrl+C soon after
`pnpm dev` no longer leaves apps running with their ports held. `database.mjs` runs `pnpm db:migrate` through the
shell, which is how Node starts pnpm's shim on Windows. `prumo clean` removes `database.mjs` once the database
exists, and only when the file is still the one its version shipped: a project already cleaned has nothing to
change there, and one that copies the new file deletes it by hand when the database exists.

### 0.4.3

Nothing generated changed. `prumo new` without a terminal refuses a single type given neither `--alone` nor
`--monorepo`.

### 0.4.2

| File | Types | Change |
|---|---|---|
| `migrations/package.json` | api | New. `{ "type": "module" }` |
| `test/support/global-setup.ts` | api | `teardown` stops the container only when one started |
| `test/features/profile/profile-form.spec.tsx` | mobile | Its `QueryClient` sets `mutations.gcTime` to `Infinity`; 0.5.1 replaces this with the helper |
| `.prumo/database/migrations.md`, `.prumo/core/testing.md` | api, every type | Say why, in the two rules above |

Why: Node loads the migrations as TypeScript by type stripping and, with no module type declared, warned
`MODULE_TYPELESS_PACKAGE_JSON` in every test worker. When the Postgres image could not be pulled, the teardown
threw a second error over the one that mattered. And the mobile profile test left a timer that made Jest
force-exit its worker.

### 0.4.1

| File | Types | Change |
|---|---|---|
| `package.json` | mobile | Adds `expo-dev-client`; `ios` and `android` run `expo run:ios` and `expo run:android` through `ports.mjs` |
| `README.md` | api, web, mobile, workspace | Says what email, social sign-in and MCP change, and how the mobile app runs |

Why: the mobile app runs in a development build instead of Expo Go. This one is a choice, not a fix: a project
happy with Expo Go can stay on it.

### 0.4.0 and 0.3.0

Not a matter of copying files. 0.3.0 replaced Better Auth with the API's own authentication, and 0.4.0 added
email verification, password reset, social sign-in and MCP scopes, each across the API and its clients. A
project generated before either keeps what it has; to adopt one, generate a reference with the feature and port
it as you would any feature, with the reference as the example.

### 0.2.0

| File | Types | Change |
|---|---|---|
| `package.json` | api, web, mobile | `better-auth`, every `@better-auth/*` package and the api's `auth` from 1.7.6 to 1.7.7, adding `@better-auth/core` |
| `package.json` | every type | `engines.node` rises to `>=22.18.0` |

Why: Better Auth 1.7.7 fixes a critical advisory present in 1.7.6. A project from 0.1.x still on Better Auth
should take this one, or a later release of Better Auth.
