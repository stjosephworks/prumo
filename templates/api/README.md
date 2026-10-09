# api

## Requirements

Node 22.18 or later, pnpm 10.26 or later, and Docker Desktop running: the database and the tests both run in it.

## Running it

```sh
pnpm install
pnpm dev
```

`.env` comes with the generated project, copied from `.env.example` with a random `JWT_SECRET`. It is not
committed, so on a fresh clone run `cp .env.example .env` and replace the secret with 32 or more random characters.

`DATABASE_URL` starts as `MISSING`. While it is, `pnpm dev` offers to create the database first: it asks for a name,
starts Postgres from `docker-compose.yml` on port 5432 or the next free one (kept in `POSTGRES_PORT`), writes the URL
into `.env`, and migrates. `pnpm db:setup` does the same at any time. Without a terminal every answer comes from a
flag: `--name`, `--port`, `--skip-migrate`, and `--json` for one JSON result on stdout.

The API listens on the port in `PORT`, `http://localhost:3000` by default. Outside production, its documentation is
at `/api/docs`.

Before it starts, `pnpm dev` checks that the port is free. When something else holds it, it says what does, by
name and pid, and asks whether to stop that process or to move this app to the next free port. Moving it writes the
new port to `.env`, along with every URL that pointed at the old one. Without a terminal, pass `--kill` or
`--change` to `scripts/ports.mjs`, or the command stops rather than choosing for you.

Ctrl+C stops everything `pnpm dev` started, not only what the terminal signals: the script remembers the processes
it spawned, stops them, and frees the port. Anything it did not start is named and left alone.

Authentication is the API's own: `/api/auth/sign-up`, `sign-in`, `refresh`, `sign-out` and `session`. The web
receives httpOnly cookies; a native client sends `X-Auth-Transport: bearer` and receives the tokens in the body.
<!-- prumo:email -->

An account must confirm its email before it can sign in. `/api/auth/email/verification` and `/api/auth/email/verify`
send and check the 6-digit code, and `/api/auth/password/forgot` and `/api/auth/password/reset` do the same for a new
password. No mail is sent yet: the `Mailer` port's only adapter, `LogMailer`, writes each mail to this API's log, in
a line starting `[mail] to`, so read the code there. Sending real mail is another adapter behind the same port; see
`.prumo/email/mailer.md`.
<!-- prumo:end-email -->
<!-- prumo:social -->

Sign-in with a provider starts at `/api/auth/social/<provider>` and comes back to its `callback`. Until a provider's
settings are filled in `.env`, it answers `provider_not_configured`; `.env.example` lists them and says where each
one comes from.
<!-- prumo:end-social -->
<!-- prumo:mcp -->

The MCP server answers at `/api/mcp`. This API is also the OAuth authorization server that issues its tokens: an MCP
client finds it through `/.well-known/oauth-protected-resource`, and the user signs in and consents on the web app.
<!-- prumo:end-mcp -->

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm test` | Runs the suite against a throwaway Postgres; Docker must be running |
| `pnpm lint` | Biome |
| `pnpm typecheck` | `tsc --noEmit`, also run before every push |
| `pnpm db:setup` | Creates a development database in Docker, writes its URL into `.env`, and migrates |
| `pnpm db:migrate` | Runs the migrations |
| `pnpm db:migration:create` | Generates a migration from the entity diff, to be read and edited before committing |

## Conventions

The rules this project follows live in `.prumo/`, and `AGENTS.md` points to them. Read those before
changing how something is done.
