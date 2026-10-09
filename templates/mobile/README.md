# mobile

## Requirements

Node 22.18 or later, pnpm 10.26 or later, and the API running. To open the app, a simulator or a device with a
development build of it, made on this machine with Xcode for iOS or Android Studio for Android. Expo Go cannot open
it, because MMKV's native code is not part of Expo Go.

## Running it

```sh
pnpm install
pnpm ios       # or pnpm android: builds the development build, installs it, and serves it
pnpm dev       # afterwards, until a native dependency changes
```

`pnpm ios` and `pnpm android` run `expo run:ios` and `expo run:android`, which generate the native project the first
time and compile it, so the first run is the slow one. `pnpm dev` then only serves the JavaScript, and the installed
build opens it, because `expo-dev-client` makes `expo start` target the development build rather than Expo Go.
Build again after adding or upgrading a package with native code.

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
<!-- prumo:email -->

Signing up first asks for the 6-digit code that confirms the email. No mail is sent yet: the API writes it to its
log, in a line starting `[mail] to`, and a forgotten password works the same way.
<!-- prumo:end-email -->

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm ios` · `pnpm android` | Builds and installs the development build, then serves it. Xcode or Android Studio |
| `pnpm test` | Jest with `jest-expo`, rendering components against a fake transport; no API needed |
| `pnpm lint` | Biome |
| `pnpm typecheck` | `tsc --noEmit`, also run before every push |
| `pnpm bundle` | Produces the iOS and Android bundles. It reads `EXPO_PUBLIC_API_URL` from the environment, not from `.env`, and fails without it |

## Conventions

The rules this project follows live in `.prumo/`, and `AGENTS.md` points to them. Read those before
changing how something is done.
