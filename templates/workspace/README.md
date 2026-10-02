# workspace

## Requirements

Node 22.18 or later and pnpm 10.26 or later. For the API, Docker Desktop running: its database and tests run in it.

## Layout

| Directory | What it is |
|---|---|
| `apps/` | Deployable applications, one per type. Each has its own README with the commands to run it |
| `packages/api-contract` | The wire contract between the clients and the API, shipped as TypeScript source |

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm install` | Installs every app and package |
| `pnpm dev` | Starts every app at once, their output prefixed by app. Mobile runs without its QR code there; use `pnpm mobile` for that |
| `pnpm api` · `pnpm web` · `pnpm mobile` · `pnpm site` | Starts one app; the workspace has a script for each app it holds |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Runs across every app and package |

## Trying it

Run `pnpm dev`. It first checks that every app's port is free, offering to stop whatever holds one or to move that
app to another port. Ctrl+C stops every app it started, and the ports it used are free again.

If the workspace holds `api` and its database is not set up yet, `pnpm dev` offers to create the database first.

If the workspace holds `web`, open `http://localhost:5173`: you are sent to sign in, and **Sign up** creates an
account and takes you to your profile. Each app's README says what it needs before it starts.

## Conventions

The rules this project follows live in `.prumo/`, and `AGENTS.md` points to them. Read those before
changing how something is done.
