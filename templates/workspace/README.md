# workspace

## Requirements

Node 22.23.4 or later and pnpm 10.26 or later. For the API, Docker Desktop running: its database and tests run in it.
On Windows, Docker Desktop needs its WSL2 backend and Linux containers. Keep the project in a Windows folder, or
work entirely inside a WSL distribution; Windows tools on a project inside the WSL filesystem are not supported.

## Layout

| Directory | What it is |
|---|---|
| `apps/` | Deployable applications, each named after its type unless it was named on purpose. Each has its own README with the commands to run it |
| `packages/api-contract` | The wire contract between the clients and the API, shipped as TypeScript source |

## Everyday commands

| Command | What it does |
|---|---|
| `pnpm install` | Installs every app and package |
| `pnpm dev` | Starts every app at once, their output prefixed by app. Mobile runs without its QR code there; use `pnpm mobile` for that |
| `pnpm api` · `pnpm web` · `pnpm mobile` | Starts one app; the workspace has a script for each app it holds, named after it |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Runs across every app and package |

## Trying it

Run `pnpm dev`. It first checks that every app's port is free, offering to stop whatever holds one or to move that
app to another port. Ctrl+C stops every app it started, and the ports it used are free again.

If the workspace holds `api` and its database is not set up yet, `pnpm dev` offers to create the database first.

If the workspace holds `web`, open `http://localhost:5173`: you are sent to sign in, and once in you land on your
profile. Each app's README says what it needs before it starts.
<!-- prumo:email -->

Signing up first asks for the 6-digit code that confirms the email. No mail is sent yet: the API writes it to its
log, in a line starting `[mail] to`, which `pnpm dev` prints with the rest of the API's output.
<!-- prumo:end-email -->
<!-- prumo:social -->

A provider's sign-in button answers *That sign-in is not set up yet* until its settings are filled in `apps/api/.env`;
`.env.example` lists them and says where each one comes from.
<!-- prumo:end-social -->

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
