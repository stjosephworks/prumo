# web

## Requirements

Node 22.23.4 or later, pnpm 10.26 or later, and the API running for anything behind the sign-in. The build downloads its
font from Google Fonts, so it needs network access.

## Running it

```sh
pnpm install
pnpm dev
```

`.env` comes with the generated project, copied from `.env.example`; `NEXT_PUBLIC_API_URL` points at the API. It is not
committed, so on a fresh clone run `cp .env.example .env`.

The app runs on `http://localhost:3200`, leaving 3000 to the API. The port comes from `WEB_PORT` in `.env`, which
`pnpm start` does not read: the production command keeps the port written in `package.json`.

Before it starts, `pnpm dev` checks that the port is free. When something else holds it, it says what does, by
name and pid, and asks whether to stop that process or to move this app to the next free port. Moving it writes the
new port to `.env`, along with every URL that pointed at the old one. Without a terminal, pass `--kill` or
`--change` to `scripts/ports.mjs`, or the command stops rather than choosing for you.

Ctrl+C stops everything `pnpm dev` started, not only what the terminal signals: the script remembers the processes
it spawned, stops them, and frees the port. Anything it did not start is named and left alone.

The home page is public: rendered once, at build time, and served as static HTML, which is what a search engine reads.
A public page that needs data fetches it on the server, as nobody. **Sign in** leads to the signed-in area, which runs
in the browser with the API's cookies, as the Vite app does: once in, you land on your profile, which you can edit.
The API must be running and migrated first, and trust this app's origin (`WEB_ORIGIN`), or the session check has
nothing to answer it.
<!-- prumo:email-code -->

Enter your email, then the 6-digit code it receives: the first code creates the account. No mail is sent yet: the API
writes it to its log, in a line starting `[mail] to`.
<!-- prumo:end-email-code -->
<!-- prumo:password -->

Follow **Sign up** to create an account with a password instead.
<!-- prumo:end-password -->
<!-- prumo:email -->

Signing up first asks for the 6-digit code that confirms the email. No mail is sent yet: the API writes it to its
log, in a line starting `[mail] to`, and **Forgot your password?** works the same way.
<!-- prumo:end-email -->

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm test` | Renders components against a fake transport, and checks each indexable page's title and description; no API needed |
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
