# Maintaining the templates

`templates/` holds one runnable skeleton per type, committed here in full. Nothing is fetched or
generated at scaffold time, so every upgrade happens in this repository, by hand, and is proved the
same way the template was proved in the first place.

## What a template must satisfy

A template is finished when it installs, passes lint and typecheck, builds, **starts**, and passes
its own tests. Starting is what separates a template from a folder of files that compiles: a wrong
environment variable, a missing migration or an unconnected ORM survives every other check.

For `mobile`, starting means the bundle is produced for both platforms, since there is no server to
answer.

## Versions

Dependencies are pinned exactly: no caret, no tilde, and no lockfile inside a template. A generated
project resolves its own tree on the day it is generated, and two projects generated a month apart
get the same versions.

This is what makes the weekly CI run meaningful. Nothing pins the transitive dependencies, so a
release that breaks a template turns the schedule red on its own, without anyone changing a line
here.

## Verifying a change

Generate a project and apply every acceptance criterion to it:

```sh
node cli/src/cli.ts new scratch --types api,web --single-tenant
node cli/scripts/verify.mjs ./scratch --types api,web --architecture monorepo
```

In a terminal `prumo new` asks what the flags leave open. Without one, every question that applies needs
its flag, and a single type needs `--alone` or `--monorepo`; `verify.mjs` takes the same layout as
`--architecture`, and assumes none.

`verify.mjs` installs, lints, typechecks, builds, starts each application, and checks the API's
response against the contract the clients compile against. It needs Docker for anything with an
API, and it removes the temporary spec it writes even when it fails.

The same script runs in CI over every generated project in the matrix, and once more on the Node floor, so a change that only works on the machine
that made it is caught on push rather than by the next person to generate.

It runs on Windows too, natively, over every type alone and over a workspace of every client. A GitHub Windows
runner's Docker runs Windows containers only, where the API's Postgres image cannot run, so there `verify.mjs` builds
the API and prints that it skipped the API's tests, migration and start. Those three are proved on Linux alone.

`cli/scripts/verify-dev.mjs` proves the other half of starting: that Ctrl+C on `pnpm dev` stops every process the run
started and frees every port. It presses Ctrl+C as a terminal does, SIGINT to the run's process group on macOS and
Linux and a console control event on Windows, and it runs in CI on Windows over each project without an API:

```sh
node cli/scripts/verify-dev.mjs ./scratch
```

`scripts/ports.mjs` ships identical in every template and at the workspace root. A change to one is copied to the
other four, and `cli/test/ports.spec.ts` runs against them. So do `.githooks/pre-commit`, `.github/workflows/flow.yml`
and `.github/rulesets/`, and `cli/test/compose.spec.ts` fails when a copy drifts.

## Regenerating `templates/mobile`

Expo's `create-expo-app` writes `AGENTS.md`, `CLAUDE.md` and `.claude/settings.json` from the
`expo-template-default` package. They were removed deliberately: Prumo writes the entry files
itself, and a template shipping its own would produce a project with two sets of instructions
disagreeing about which file is canonical.

**If the template is ever regenerated, remove those three again.** No Expo runtime command writes
them, verified against SDK 57, so nothing brings them back after the first removal.

`templates/site` needs no equivalent step: `agentRules: false` in `next.config.ts` keeps Next from
writing its own.

## When running a template contradicts a document

The knowledge base in `.prumo-templates/` describes what the templates do. When the two disagree,
the running code is right and the document is corrected in the same change. Over twenty documents
were corrected this way while the templates were built, which is the reason the templates exist at
all: prose nobody executes drifts, and nothing announces it.
