<p align="center">
  <img src="https://raw.githubusercontent.com/stjosephworks/prumo/main/docs/brand/brand.png" alt="Prumo" width="300">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@stjoseph/prumo"><img src="https://img.shields.io/npm/v/%40stjoseph%2Fprumo?color=1e3a5f&label=npm" alt="npm"></a>
  <a href="https://github.com/stjosephworks/prumo/blob/main/LICENSE"><img src="https://img.shields.io/github/license/stjosephworks/prumo?color=1e3a5f" alt="MIT"></a>
</p>

Prumo is a set of choices a team has already made, packaged so that starting a new TypeScript
project does not mean making them all over again. Which framework, how a module is laid out, where
the database rules live, how authentication is wired, what a test is allowed to assume: each of
those was decided once, written down with the reasoning and with what the choice costs, and then
turned into something that actually runs.

Put briefly, Prumo is the validation of a well built project without heavy architectural
bureaucracy, done up front instead of discovered three months in. Well built here does not mean
heavily layered. Every choice follows what the framework itself already indicates, and the one
structure of Prumo's own is the API's: ports and adapters, so the domain imports neither the
database nor the HTTP framework.

A new project receives two things. The first is code that already works: installed, wired together,
and proven by starting rather than by compiling. The second is a `.prumo/` folder holding the
conventions that code follows. Any AI assistant working in that repository reads the folder and
knows the rules without anyone explaining them, which is the whole point: **the conventions live in
the project, not in someone's head.**

Applications differ, so the choices are not one fixed bundle. Three answers shape what arrives:
which artefacts the project has, whether they sit alone or in one workspace, and whether the
application serves several tenants. The same body of decisions covers an API on its own and a
workspace holding four applications, without either one carrying rules it has no use for.

## Requirements

Node 22.18 or later, pnpm 10.26 or later, and Docker for anything with an API. `prumo doctor` checks
all of it. Prumo runs on macOS and Linux; Windows is not supported yet.

## Running it

```sh
npx @stjoseph/prumo new my-app        # npm
pnpm dlx @stjoseph/prumo new my-app   # pnpm
```

Either runner starts it, and the generated project installs with pnpm, which it needs anyway. The
published package is [`@stjoseph/prumo`](https://www.npmjs.com/package/@stjoseph/prumo), and the
command it installs is `prumo`.

It asks what to build, writes the project into `my-app/`, runs `git init`, and installs. Nothing is
committed, so the first commit is yours and the diff shows everything Prumo wrote. `prumo new .`
writes into the current directory instead, which must be empty, and names the project after it. If
anything fails or is interrupted, Prumo removes what it wrote, so the same command can run again.
A project cannot be named `api`, `web`, `mobile` or `site`: those are the names its apps take inside
a workspace.

Every question also has a flag, which is how CI runs it without a terminal. Outside an interactive
terminal a missing answer is an error rather than a default, so nothing important gets decided by
silence:

```sh
npx @stjoseph/prumo new my-app --types api,web --single-tenant --no-mcp --email --no-social
```

| Flag | What it answers |
|---|---|
| `--types api,web,mobile,site` | What the project contains. More than one type makes a workspace |
| `--alone` or `--monorepo` | How a single type is laid out |
| `--multi-tenant` or `--single-tenant` | Whether the application serves several tenants. Multi-tenant ships the `multi-tenancy` conventions; the generated code itself is not tenant-aware yet |
| `--mcp` or `--no-mcp` | With an api and a web: whether AI assistants reach the API through MCP, signed in as the user |
| `--email` or `--no-email` | With an api: email verification and password reset, by a 6-digit code sent through the `Mailer` port, which writes to the log until you give it a provider |
| `--social google,apple` or `--no-social` | With an api and a web or mobile: sign-in with Google, Apple, or both |
| `--skip-install` | Stops after writing the files |

## Commands

| Command | What it does |
|---|---|
| `prumo new [name \| .]` | Generates a project |
| `prumo db` | Inside a project with an API: creates the development database in Docker and writes its URL into `.env` |
| `prumo clean` | Removes what the project needed only once, today the database setup, once the database exists. Only the Prumo version that generated the project cleans it |
| `prumo doctor` | Checks Node, pnpm, git and Docker on this machine |
| `prumo version` · `--version` · `-v` | Prints the CLI version |
| `prumo help [command]` · `--help` | Lists the commands, or describes one |

Every command takes `--json`: stdout then holds exactly one document, `{ "ok": true, "command", "data" }` or
`{ "ok": false, "command", "error": { "code", "message" } }`, anything written for a person goes to stderr, nothing
is asked, and the exit code is 0 only when `ok` is true.

## What it generates

| Type | What you get |
|---|---|
| `api` | Fastify with a domain/infra structure, tsyringe, Zod, MikroORM on PostgreSQL, its own JWT authentication, Swagger UI, Vitest with Testcontainers |
| `web` | Vite, React, TanStack Router and Query, Tailwind, shadcn/ui, forms validated with Zod |
| `mobile` | Expo with Expo Router, NativeWind, MMKV, and the tokens kept in `expo-secure-store` |
| `site` | Next on the App Router, static by default, for pages that have to be indexed |

One type produces that project on its own. Several produce a pnpm workspace: each application under
`apps/`, the wire contract shared through `packages/api-contract` so a change on one side breaks the
other at typecheck, and one version per dependency held in a catalog.

Every template is committed here in full, and none of them is generated by calling somebody else's
scaffolder at install time. Each one installs, passes lint and typecheck, builds, starts, and passes
its own tests before it ships. Versions are pinned exactly, with no carets, so two projects generated
a month apart are the same project.

## What lands in the project

| File | What it is |
|---|---|
| `.prumo/` | The conventions, in ten areas. Only the areas the answers call for are copied |
| `.prumo/INDEX.md` | One line per document. Generated by the tool, and safe to regenerate |
| `AGENTS.md` | The pointer into `.prumo/`, read by Codex, Cursor, Copilot, Gemini CLI and others |
| `CLAUDE.md` | An `@AGENTS.md` import, for Claude Code |

The ten areas are `core`, `api`, `database`, `client`, `web`, `mobile`, `site`, `monorepo`,
`multi-tenancy` and `mcp`. Only `core` ships unconditionally, because everything in it is true of every type;
the rest follow the answers, since advice about a platform the project does not have is worse than
no advice at all.

Once written, those documents belong to the team. Prumo does not come back and rewrite them.

## Where the rest is written

| Document | Holds |
|---|---|
| [`docs/stack.md`](https://github.com/stjosephworks/prumo/blob/main/docs/stack.md) | What is locked, what was deliberately dropped, and the version floors |
| [`docs/structure.md`](https://github.com/stjosephworks/prumo/blob/main/docs/structure.md) | The `.prumo/` layout, and the rule deciding which areas a project receives |
| [`docs/document-template.md`](https://github.com/stjosephworks/prumo/blob/main/docs/document-template.md) | The shape every convention document fills |
| [`docs/maintaining-templates.md`](https://github.com/stjosephworks/prumo/blob/main/docs/maintaining-templates.md) | How a template is changed, and how the change is proved |

## Releasing

`main` publishes itself. A push to `main` runs the whole CI, and when `cli/package.json` carries a version the
registry does not have yet, the `publish` job sends it to npm through npm's trusted publishing, with provenance and
without a token in the repository. Any other push to `main` publishes nothing.

## Status

Prumo is in beta: every template runs and every generated project is verified in CI, and what a generated project looks like can still change before 1.0.
Updating a project's `.prumo/` in place comes after 1.0.

MIT licensed. See [`LICENSE`](https://github.com/stjosephworks/prumo/blob/main/LICENSE).
