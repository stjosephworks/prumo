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
  .prumo/
    INDEX.md         ← generated. One line per file. The tool's territory
    config.json      ← what the project answered, and the Prumo version that wrote it
    core/            ← always present
    api/             ← type api
    database/        ← type api
    client/          ← any client type
    web/             ← type web
    mobile/          ← type mobile
    site/            ← type site
    monorepo/        ← architecture monorepo
    multi-tenancy/   ← multi-tenant projects only
    mcp/             ← projects that answered yes to MCP
```

**`.prumo/` holds two natures, and the split is deliberate.** `INDEX.md` and `config.json` are
written by the tool and never hand-edited. Everything else is prose the team owns and maintains.
Regenerating the first pair is always safe; regenerating the rest is not.

---

## Why `.prumo/` and not `.context/`

`context` is a generic word, and a developer may reasonably create a `context/` of their own. There
is no established *directory* convention to align with either, since `AGENTS.md` uses nesting rather than
a folder, and `.cursor/`, `.claude/` and `.github/` are all vendor-namespaced. A namespaced folder
cannot collide with anything, now or with a future standard.

The dot is accurate here: the folder is maintained by tooling. `prumo new` writes it; commands that add to
it or refresh it are planned after V1.

---

## Areas

Areas do not mirror types. Five of the ten are not types at all: `database/` follows a type, `client/`
follows any of three, `monorepo/` follows the architecture, `multi-tenancy/` follows a third axis of its
own, and `mcp/` a fourth, asked only when there is an api and a web.

| Area | Holds | Ships when |
|---|---|---|
| `core/` | What crosses every type: TypeScript config, Biome and the pre-commit hook, Vitest, file naming, code style | **always** |
| `api/` | Fastify rules and the domain/infra structure: ports, use cases, DTOs, the HTTP edge | type is `api` |
| `database/` | Database rules and performance. Separate from `api/` so a future worker or lambda can take it without being an API | type is `api` |
| `client/` | What every client shares: calling the API, the error type, queries, forms | type is `web`, `mobile` or `site` |
| `web/` | Vite + React rules | type is `web` |
| `mobile/` | Expo rules | type is `mobile` |
| `site/` | Next rules, for indexed pages | type is `site` |
| `monorepo/` | Workspace organisation | architecture is `monorepo` |
| `multi-tenancy/` | `tenant_id` across the layers, tenant resolution, isolation | the project is multi-tenant |
| `mcp/` | The MCP server, its tools, and the OAuth that authorizes them | the project has an api and a web and answered yes to MCP |

This table is the inclusion rule, and it lives in the CLI as one explicit table, not as a manifest
per area, and not as convention-plus-exceptions.

**`client/` is the only row that is not a simple equality.** It exists because `data.md` and `forms.md`
were nearly identical between `web` and `mobile`, and those two documents carry most of the silent-failure
rules on the client side, and two copies drifting would mean one of them quietly ceasing to be true. A `site`
receives it and uses the wire-contract half; the document says which half is Query-specific.

**`core/` is the only unconditional area, so it is always-loaded context.** The bar for entering it
is *crossing every type in fact*, not seeming general. If it bloats, every project pays on every
session.

**`web` and `site` are separate on purpose.** They share React and Tailwind and nothing else that
matters: TanStack Router and TanStack Query do not exist in Next, and routing, data fetching, build
and deploy target differ end to end. One document covering both would say *if Next do X, if Vite do
Y* in nearly every rule.

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
project actually received. `AGENTS.md` points at it in a single line.

**The split is about ownership, not size.** `AGENTS.md` is where the team writes *our deploy works
like this* and *do not touch X*. If `prumo add` had to rewrite it to update a list, it would be
rewriting a file with human edits in it, and a tool that rewrites a hand-edited file loses content
sooner or later. `INDEX.md` is the tool's territory; regenerating it is safe.

---

## What this does not decide

| Question | Owner |
|---|---|
| What a document contains: frontmatter, sections, `reviewed:`, `applies-to:` | step 0.3 |
