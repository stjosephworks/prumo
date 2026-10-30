# The `.prumo/` structure

What a generated project receives, and how it is laid out. Settled in step 0.2 on 2026-09-10.

This document describes **where files live and what they are called**. What goes *inside* a document
(frontmatter, sections, `reviewed:`) is step 0.3 and is not decided here.

---

## Shape

```
<project>/
  AGENTS.md          ← the pointer. Written once, then the team's territory
  CLAUDE.md          ← "@AGENTS.md" plus anything Claude-specific
  .context/
    INDEX.md         ← written empty once. The project's own rules, one line per file
    <subject>/…      ← the team's and its assistant's, never the tool's
  .prumo/
    INDEX.md         ← generated. One line per file. The tool's territory
    config.json      ← what the project answered, and the Prumo version that wrote it
    core/            ← always present
    i18n/            ← always present: the project's languages and how one is added
    api/             ← type api
    database/        ← type api
    client/          ← any client type
    web/             ← type web, whatever its framework
    web-vite/        ← a web app on Vite
    web-next/        ← a web app on Next
    web-astro/       ← a web app on Astro
    mobile/          ← type mobile
    monorepo/        ← architecture monorepo
    multi-tenancy/   ← multi-tenant projects only
    mcp/             ← projects that answered yes to MCP
    codes/           ← projects that send codes at all: their table, limits and answers
    email/           ← projects that send codes by email: verification, or sign-in by code
    phone/           ← projects that sign in by a code texted to a phone
    social/          ← projects that chose a sign-in provider
```

**`.prumo/` holds two natures, and the split is deliberate.** `INDEX.md` and `config.json` are
written by the tool and never hand-edited, except `languages` in `config.json`: a language the project adds goes
there too, so that `prumo add` gives a new app every language the others speak (`i18n/languages.md`). Everything else
is prose the team owns and maintains. Regenerating the first pair is always safe; regenerating the rest is not.

---

## `.prumo/` and `.context/`

**`.prumo/` is what Prumo ships; `.context/` is what the project decides for itself** (2026-10-30). Both
are read through `AGENTS.md`, and where they disagree `.context/` wins, because it was written for this project and
`.prumo/` for every project of its kind.

`.prumo/` is namespaced because it is the tool's. There is no established *directory* convention to align with,
since `AGENTS.md` uses nesting rather than a folder, and `.cursor/`, `.claude/` and `.github/` are all
vendor-namespaced. A namespaced folder cannot collide with anything, now or with a future standard. `prumo new`
writes it, and `prumo add` brings the areas a new app needs.

`.context/` is named for what it holds rather than for the tool, because nothing of the tool's goes in it after the
first day: `prumo new` writes its empty `INDEX.md`, and no command touches it again. Its files take the shape of
every document here, filed in folders by subject. `core/context.md` tells the assistant when to write one: when
the developer states a rule that outlasts the task, without asking; when it only inferred one, once the developer
agrees.

---

## Areas

Areas do not mirror types. Fourteen of the seventeen are not types at all: `core/` and `i18n/` ship always, `database/` follows a
type, `client/` follows either client type, `web-vite/`, `web-next/` and `web-astro/` follow a web app's framework,
`monorepo/` follows the architecture, `multi-tenancy/` follows a third axis of its own, `mcp/` a fourth, asked only
when there is an api and a web, `codes/`, `email/` and `phone/` follow how people sign in and whether emails are
verified, and `social/` follows the providers, asked when there is an api and a client to come back to.

A document in an area may mark what it says about one feature with `<!-- prumo:<feature> -->` and
`<!-- prumo:end-<feature> -->`: a project without that feature receives the document without it, as it receives a
README. `api/auth.md` holds a paragraph for each way in, and `email/codes.md` one for verification and one for
sign-in by code, so no project reads about a flow it does not have.

| Area | Holds | Ships when |
|---|---|---|
| `core/` | What crosses every type: TypeScript config, Biome and the pre-commit hook, Vitest, file naming, code style, the branch flow | **always** |
| `i18n/` | The project's languages: the messages every word comes from, the base they are checked against, and how a language is added | **always** |
| `api/` | Fastify rules and the domain/infra structure: ports, use cases, DTOs, the HTTP edge | type is `api` |
| `database/` | Database rules and performance. Separate from `api/` so a future worker or lambda can take it without being an API | type is `api` |
| `client/` | What every client shares: calling the API, the error type, queries, forms | type is `web` or `mobile` |
| `web/` | What every web app shares: shadcn components and their variants | type is `web` |
| `web-vite/` | Vite + React: TanStack Router, structure | a web app on Vite |
| `web-next/` | Next: rendering public pages on the server and the signed-in area in the browser, structure | a web app on Next |
| `web-astro/` | Astro: pages built ahead of time, React islands, structure | a web app on Astro |
| `mobile/` | Expo rules | type is `mobile` |
| `monorepo/` | Workspace organisation | architecture is `monorepo` |
| `multi-tenancy/` | `tenant_id` across the layers, tenant resolution, isolation | the project is multi-tenant |
| `mcp/` | The MCP server, its tools and their scopes, and the OAuth that authorizes them | the project has an api and a web and answered yes to MCP |
| `codes/` | One-time codes whatever their channel: the table, the limits, the sweep, and answers that say nothing about accounts | the project has an api and sends any code |
| `email/` | The `Mailer` port, and the codes sent by email: to verify an email and reset a password, or to sign in | the project has an api and answered yes to email, or signs in by `email-code` |
| `phone/` | The `TextMessages` and `PhoneNumbers` ports, `SMS_COUNTRIES`, and sign-in by a texted code | the project has an api and signs in by `phone-code` |
| `social/` | Sign-in with a provider: the trip there and back, and how an account is linked | the project has an api, a web or mobile app, and chose a provider |

This table is the inclusion rule, and it lives in the CLI as one explicit table, not as a manifest
per area, and not as convention-plus-exceptions.

**`client/` is the only row that is not a simple equality.** It exists because `data.md` and `forms.md`
were nearly identical between `web` and `mobile`, and those two documents carry most of the silent-failure
rules on the client side, and two copies drifting would mean one of them quietly ceasing to be true. A Next or Astro
app's public pages use the wire-contract half, and its signed-in area all of it; the document says which half is
Query-specific.

**`core/` and `i18n/` are the only unconditional areas, so they are always-loaded context.** The bar for
entering one is *crossing every type in fact*, not seeming general. If either bloats, every project pays on every
session. `i18n/` is its own area rather than a file of `core/` because every project is born speaking its languages
from messages (2026-10-29), and what each type adds to it lives in that type's area: the API's in `api/`.

**One type, one area per framework.** Since 2026-10-27 `web` is one type whatever it is built with, because a
public site is often the whole web app and needs the same sign-in. Its frameworks share React, Tailwind, shadcn and,
in the browser, the contract and TanStack Query, which is what `web/` and `client/` hold. They share nothing else that
matters: routing, rendering, data fetching on the server, build and deploy target differ end to end, so each has its
area. One document covering all three would say *if Next do X, if Vite do Y* in nearly every rule.

---

## Files inside an area

**One file per subject**, where a subject is settled by a test:

> Would an assistant ever need this without the rest?

If the answer is no, the two subjects are one file. A file only ever read alongside another does not
justify existing.

**Plain names, no numbering.** `modules.md`, not `10-modules.md`. The folder already does the
grouping a number used to do, and reading order is the index's job. Numbers age badly: inserting
between 10 and 20 works until the third file, and renumbering breaks every link, including, once
path-scoped rules exist, every glob that names a file.

---

## The index

`.prumo/INDEX.md` is generated at scaffold time and lists one line per file across the areas the
project actually received. `.context/INDEX.md` lists the project's own rules in the same form, kept by whoever writes
one. `AGENTS.md` points at both, a line each.

**The split is about ownership, not size.** `AGENTS.md` is where the team writes *our deploy works
like this* and *do not touch X*. If `prumo add` had to rewrite it to update a list, it would be
rewriting a file with human edits in it, and a tool that rewrites a hand-edited file loses content
sooner or later. `INDEX.md` is the tool's territory; regenerating it is safe.

---

## What this does not decide

| Question | Owner |
|---|---|
| What a document contains: frontmatter, sections, `reviewed:`, `applies-to:` | step 0.3 |
