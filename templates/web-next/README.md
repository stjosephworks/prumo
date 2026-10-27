# web

## Requirements

Node 22.18 or later, and pnpm 10.26 or later. The build downloads its font from Google Fonts, so it needs network access.

## Running it

```sh
pnpm install
pnpm dev
```

The app runs on `http://localhost:3200`, leaving 3000 to the API. The port comes from `WEB_PORT` in `.env`, which
`pnpm start` does not read: the production command keeps the port written in `package.json`.

Before it starts, `pnpm dev` checks that the port is free. When something else holds it, it says what does, by
name and pid, and asks whether to stop that process or to move this app to the next free port. Moving it writes the
new port to `.env`, along with every URL that pointed at the old one. Without a terminal, pass `--kill` or
`--change` to `scripts/ports.mjs`, or the command stops rather than choosing for you.

Ctrl+C stops everything `pnpm dev` started, not only what the terminal signals: the script remembers the processes
it spawned, stops them, and frees the port. Anything it did not start is named and left alone.

A public page fetches its data on the server, from the API at `NEXT_PUBLIC_API_URL`.

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm test` | Checks that each indexable page exports a title and a description |
| `pnpm lint` | Biome |
| `pnpm typecheck` | Generates Next's route types, then `tsc --noEmit`; also run before every push |
| `pnpm build` · `pnpm start` | Production build, then serves it |

## Branches

Work lands through `dev` → `staging` → `main`, and large work through a `project/` branch first;
`.prumo/core/git.md` has the rule. `.github/workflows/flow.yml` fails a pull request that skips a step. To make it
required and refuse direct pushes on GitHub, push the three branches and create the two rulesets once, with the
[GitHub CLI](https://cli.github.com):

```sh
git push -u origin main
git push origin main:dev main:staging
gh api repos/{owner}/{repo}/rulesets --input .github/rulesets/flow.json
gh api repos/{owner}/{repo}/rulesets --input .github/rulesets/project.json
```

## Conventions

The rules this project follows live in `.prumo/`, and `AGENTS.md` points to them. Read those before
changing how something is done.
