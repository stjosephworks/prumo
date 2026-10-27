# Branches

## Rule

Land work through one chain, and skip no step:

```
task/ fix/ chore/ docs/ refactor/  →  dev  →  staging  →  main
task/<name>  →  project/<name>  →  dev
dev  →  project/<name>                     to stay current
```

Name every branch with one of six prefixes: `task/` for a piece of work, `fix/` for a defect, `chore/` for upkeep,
`docs/` for writing, `refactor/` for a change of shape with no change of behaviour, and `project/` for large work.
Do not use any other prefix, `feat/` included.

Give large work a `project/<name>` branch, created from `dev`. Split it into `task/<name>` branches, each opened
into the project. **Open the project into `dev` only once it is decided to ship.** Keep it current with a pull
request from `dev` into it, so conflicts are settled there, a few at a time, rather than all at once at the end.

Open small work straight into `dev`.

Push to none of `main`, `staging`, `dev` or a `project/` branch. Every change reaches them as a pull request.

## Rationale

`dev` is the queue for what ships next. A large change merged there early decides the release order for everyone:
a smaller one that must go first is stuck behind it, or someone untangles a merge to get it out. A `project/`
branch lets several people build and review the large change in parts, through its tasks, without it entering the
queue until it is ready and wanted.

**The prefixes are a closed list because the check is the only thing that reads them.** A prefix outside it is a
branch whose destination nobody wrote down; refusing it costs a rename, and accepting it would leave the list as a
suggestion.

`staging` is where a release is tried before `main`. Nothing reaches it except `dev` whole, so what was tried is
what ships.

## Applies to

Every branch and every pull request in this repository.

## Examples

Large work:

```
✅  project/social-sign-in        ← from dev
    task/configure-apple          → project/social-sign-in
    task/configure-google         → project/social-sign-in
    project/social-sign-in        → dev, once it is decided to ship
❌  task/configure-apple          → dev, while the rest of sign-in is unfinished
```

A branch name:

```
✅  fix/expired-session-redirect
❌  feat/export-csv               ← task/export-csv
❌  hotfix/login                  ← fix/login
```

## Enforcement

`.github/workflows/flow.yml` fails a pull request whose source does not follow the chain: `main` takes only
`staging`, `staging` takes only `dev`, `dev` takes a `project/` branch or one of the other five prefixes, and a
`project/` branch takes only `task/`, or `dev`.

**The check only fails; it does not block.** A ruleset makes it required and refuses a direct push, and a ruleset
is configured on GitHub, not in a file: the README says how to create one. Without it, this rule is review only.
Outside GitHub the workflow never runs.
