# web

## Requirements

Node 22.18 or later, pnpm 10.26 or later, and the API running.

## Running it

```sh
pnpm install
pnpm dev
```

`.env` comes with the generated project, copied from `.env.example`; `VITE_API_URL` points at the API. It is not
committed, so on a fresh clone run `cp .env.example .env`.

The app runs on `http://localhost:5173`, which is the origin the API trusts by default (`WEB_ORIGIN`). The port
comes from `WEB_PORT` in `.env`.

Before it starts, `pnpm dev` checks that the port is free. When something else holds it, it says what does, by
name and pid, and asks whether to stop that process or to move this app to the next free port. Moving it writes the
new port to `.env`, along with every URL that pointed at the old one. Without a terminal, pass `--kill` or
`--change` to `scripts/ports.mjs`, or the command stops rather than choosing for you.

Ctrl+C stops everything `pnpm dev` started, not only what the terminal signals: the script remembers the processes
it spawned, stops them, and frees the port. Anything it did not start is named and left alone.

Open it and you are sent to sign in, because everything but the sign-in and sign-up pages needs a session. Follow
**Sign up** to create an account; you land on your profile, which you can edit. The API must be running and
migrated first, or the session check has nothing to answer it.
<!-- prumo:email -->

Signing up first asks for the 6-digit code that confirms the email. No mail is sent yet: the API writes it to its
log, in a line starting `[mail] to`, and **Forgot your password?** works the same way.
<!-- prumo:end-email -->

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm test` | Renders components against a fake transport; no API needed |
| `pnpm lint` | Biome |
| `pnpm typecheck` | `tsc --noEmit`, also run before every push |
| `pnpm build` | Production build into `dist/`; `pnpm preview` serves it |

## Conventions

The rules this project follows live in `.prumo/`, and `AGENTS.md` points to them. Read those before
changing how something is done.
