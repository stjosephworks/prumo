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

Better Auth is one family: `better-auth`, `auth` and every `@better-auth/*` package move to the same version
in one change, and every template that uses a plugin declares `@better-auth/core` at that version. The
plugins take the core as a peer, so without it pnpm installs the newest core beside the one `better-auth`
pins. `cli/test/better-auth.spec.ts` fails when the family drifts apart.

## Verifying a change

Generate a project and apply every acceptance criterion to it:

```sh
node cli/src/cli.ts new scratch --types api,web --single-tenant
node cli/scripts/verify.mjs ./scratch --types api,web --architecture monorepo
```

`verify.mjs` installs, lints, typechecks, builds, starts each application, and checks the API's
response against the contract the clients compile against. It needs Docker for anything with an
API, and it removes the temporary spec it writes even when it fails.

The same script runs in CI over every generated project in the matrix, and once more on the Node floor, so a change that only works on the machine
that made it is caught on push rather than by the next person to generate.

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
