# mobile

## Requirements

Node 22.18 or later, pnpm 10.26 or later, and the API running. A simulator or a device with Expo Go
to open the app.

## Running it

```sh
pnpm install
pnpm dev
```

`.env` comes with the generated project, copied from `.env.example`; `EXPO_PUBLIC_API_URL` points at the API. It is
not committed, so on a fresh clone run `cp .env.example .env`.

Metro serves on the port in `METRO_PORT`, 8081 by default.

Before it starts, `pnpm dev` checks that the port is free. When something else holds it, it says what does, by
name and pid, and asks whether to stop that process or to move this app to the next free port. Moving it writes the
new port to `.env`, along with every URL that pointed at the old one. Without a terminal, pass `--kill` or
`--change` to `scripts/ports.mjs`, or the command stops rather than choosing for you.

Ctrl+C stops everything `pnpm dev` started, not only what the terminal signals: the script remembers the processes
it spawned, stops them, and frees the port. Anything it did not start is named and left alone.

On an Android emulator `localhost` is the emulator itself; point `EXPO_PUBLIC_API_URL` at your machine's address.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm test` | Jest with `jest-expo`, rendering components against a fake transport; no API needed |
| `pnpm lint` | Biome |
| `pnpm typecheck` | `tsc --noEmit`, also run before every push |
| `pnpm bundle` | Produces the iOS and Android bundles. It reads `EXPO_PUBLIC_API_URL` from the environment, not from `.env`, and fails without it |

## Conventions

The rules this project follows live in `.prumo/`, and `AGENTS.md` points to them. Read those before
changing how something is done.
