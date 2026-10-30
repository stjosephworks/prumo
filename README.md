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

Applications differ, so the choices are not one fixed bundle. The answers shape what arrives:
which artefacts the project has, whether they sit alone or in one workspace, whether the application
serves several tenants, and whether it ships MCP, email verification and sign-in with a provider. The same body of decisions covers an API on its own and a
workspace holding four applications, without either one carrying rules it has no use for.

## Requirements

Node 22.23.4 or later, pnpm 10.26 or later, and Docker for anything with an API. `prumo doctor` checks
all of it. Prumo runs on macOS, Linux and Windows.

On Windows it runs natively: the project lives in a Windows folder, and the Windows Node and pnpm run it.
Docker Desktop, with its WSL2 backend and set to Linux containers, is only where the database and the API's
tests run.

Inside a WSL distribution, with the distribution's own terminal, Node, pnpm and Docker, Prumo is on Linux, which is
supported, though not tested on WSL specifically. Mixing the two is not supported: Windows tools, Prumo Desktop
included, working on a project inside the WSL filesystem (`\\wsl$` or `\\wsl.localhost`).


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
A project cannot be named `api`, `web` or `mobile`: those are the names its apps take inside
a workspace. Nor can it take the name of a package that pnpm's compatibility database extends, such as `ws`:
pnpm applies the extension to the project's own `package.json` and installs what it adds. Prumo names
the packages and suggests another name.

Every question also has a flag, which is how CI runs it without a terminal. Outside an interactive
terminal every question that applies needs its flag, the layout of a single type included: a missing
answer is an error rather than a default, so nothing important gets decided by silence:

```sh
npx @stjoseph/prumo new my-app --types api,web --single-tenant --single-language --languages en --no-mcp --sign-in password --email --no-social
npx @stjoseph/prumo new my-api --types api --alone --single-tenant --multi-language --languages pt-BR,en --sign-in email-code
npx @stjoseph/prumo new my-shop --types api,web:next --single-tenant --multi-language --languages es-419,en,pt-BR --no-mcp --sign-in email-code --social google
```

| Flag | What it answers |
|---|---|
| `--types api,web,mobile` | What the project contains. More than one type makes a workspace. `web:vite`, `web:next` or `web:astro` chooses the web app's framework; `web` alone is Vite, and a terminal asks |
| `--app <name>=<type>` | Advanced, repeatable: an app with a name of its own, as `--app backoffice=web` or `--app blog=web:astro`. A type left out of `--types` and given here is renamed. Only `web` repeats, on any framework, and an `--app` makes a workspace |
| `--alone` or `--monorepo` | How a single type is laid out, so one type needs one of them. Several types always make a workspace and refuse `--alone` |
| `--multi-tenant` or `--single-tenant` | Whether the application serves several tenants. Multi-tenant ships the `multi-tenancy` conventions; the generated code itself is not tenant-aware yet |
| `--single-language` or `--multi-language` | Whether the project speaks one language, its words written where they are shown, as a person writes them by hand; or speaks from messages, one file per language with a base the others are checked against, so a language is added later as a file and its translation. A project of one language has nothing of the second: no messages, no language switcher, no language in its addresses or its accounts |
| `--languages en,pt-BR,es-419` | The languages the project speaks: with `--single-language` exactly one; with `--multi-language` one or more, the base first, the one spoken when none of a person's fits. Prumo translates its templates into these three; another is added once a multi-language project exists, as `.prumo/i18n/languages.md` says |
| `--mcp` or `--no-mcp` | With an api and a web: whether AI assistants reach the API through MCP, signed in as the user |
| `--sign-in password,email-code,phone-code` | With an api: how people sign in, one or more. `password` is an email and a password; `email-code` and `phone-code` a 6-digit code sent by email or by text, the first of which creates the account. Texts go only to the countries in `SMS_COUNTRIES`. Social sign-in comes on top of them, never alone |
| `--email` or `--no-email` | With an api and `password`: email verification and password reset, by a 6-digit code sent through the `Mailer` port, which writes to the log until you give it a provider |
| `--social google,apple` or `--no-social` | With an api and a web or mobile: sign-in with Google, Apple, or both |
| `--skip-install` | Stops after writing the files |

## Commands

| Command | What it does |
|---|---|
| `prumo new [name \| .]` | Generates a project |
| `prumo add <type> [name]` | Inside a workspace: adds an app, named after its type unless a name is given, as `prumo add web backoffice` or `prumo add web:next shop`. It gets the next free port, the shared contract, the API's trust when it is a web app, and the `.prumo/` areas it needs. Only the Prumo version that generated the project adds to it |
| `prumo db` | Inside a project with an API: creates the development database in Docker and writes its URL into `.env` |
| `prumo clean` | Removes what the project needed only once, today the database setup, once the database exists. Only the Prumo version that generated the project cleans it |
| `prumo doctor` | Checks Node, pnpm, git and Docker on this machine, and that Docker runs Linux containers |
| `prumo version` · `--version` · `-v` | Prints the CLI version |
| `prumo help [command]` · `--help` | Lists the commands, or describes one |

Every command takes `--json`: stdout then holds exactly one document, `{ "ok": true, "command", "data" }` or
`{ "ok": false, "command", "error": { "code", "message" } }`, anything written for a person goes to stderr, nothing
is asked, and the exit code is 0 only when `ok` is true.

## What it generates

| Type | What you get |
|---|---|
| `api` | Fastify with a domain/infra structure, tsyringe, Zod, MikroORM on PostgreSQL, its own JWT authentication, Swagger UI, Vitest with Testcontainers |
| `web` | React, Tailwind, shadcn/ui, forms validated with Zod, and the same sign-in on each framework. **Vite** (the default): TanStack Router and Query, an app behind a sign-in. **Next**: the App Router, public pages rendered on the server for search engines, the signed-in area in the browser. **Astro**: pages built ahead of time with no JavaScript, React islands where something acts |
| `mobile` | Expo with Expo Router, NativeWind, MMKV, and the tokens kept in `expo-secure-store` |

One type produces that project on its own. Several produce a pnpm workspace: each application under
`apps/`, named after its type unless it was named on purpose, the wire contract shared through `packages/api-contract` so a change on one side breaks the
other at typecheck, and one version per dependency held in a catalog.

Every template is committed here in full, and none of them is generated by calling somebody else's
scaffolder at install time. Each one installs, passes lint and typecheck, builds, starts, and passes
its own tests before it ships. Versions are pinned exactly, with no carets, so two projects generated
a month apart are the same project.

## What lands in the project

| File | What it is |
|---|---|
| `.prumo/` | The conventions, in seventeen areas. Only the areas the answers call for are copied |
| `.prumo/INDEX.md` | One line per document. Generated by the tool, and safe to regenerate |
| `.context/INDEX.md` | The project's own rules, which win over `.prumo/`. Written empty; the assistant adds a rule when the developer states one, as `.prumo/core/context.md` says |
| `AGENTS.md` | The pointer into `.context/` and `.prumo/`, read by Codex, Cursor, Copilot, Gemini CLI and others |
| `CLAUDE.md` | An `@AGENTS.md` import, for Claude Code |

The seventeen areas are `core`, `i18n`, `api`, `database`, `client`, `web`, `web-vite`, `web-next`, `web-astro`,
`mobile`, `monorepo`, `multi-tenancy`, `mcp`, `codes`, `email`, `phone` and `social`. Only `core` ships unconditionally, because everything in it is true of every type;
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
| [`docs/upgrading.md`](https://github.com/stjosephworks/prumo/blob/main/docs/upgrading.md) | What each release changed in the files it generates, and how an existing project carries it over |

## Releasing

`main` publishes itself. A push to `main` runs the whole CI, and when `cli/package.json` carries a version the
registry does not have yet, the `publish` job sends it to npm through npm's trusted publishing, with provenance and
without a token in the repository. Any other push to `main` publishes nothing.

## Upgrading a project

Prumo does not update a project it generated, and there is no `prumo upgrade`. For each release that changed
the generated files, [`docs/upgrading.md`](https://github.com/stjosephworks/prumo/blob/main/docs/upgrading.md)
lists what to copy or change and why, and gives one method: generate a reference project with the same answers
at the old and the new version, and diff the files listed. A file your team has edited is merged by hand, never
overwritten.

## Status

Prumo is in beta: every template runs and every generated project is verified in CI, and what a generated project looks like can still change before 1.0.
Updating a project's `.prumo/` in place comes after 1.0.

MIT licensed. See [`LICENSE`](https://github.com/stjosephworks/prumo/blob/main/LICENSE).
