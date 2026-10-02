# Configuration

## Rule

Validate the environment with the Zod schema in `src/infra/config/env.ts`. Convert a value that is not a
string with `z.coerce`. Do not add another configuration library.

Register the parsed value in the container under `ENV` and inject it with the `Env` type. Nothing reads a
setting by a string key.

Fail the boot when validation fails. Report every invalid variable at once, ignore unknown ones, and name the
variable without printing its value.

Keep `.env` in `.gitignore`. Commit `.env.example` with every variable and a safe sample value. Do not read
an env file in production.

Load `.env` outside production with Node's `process.loadEnvFile`, inside `loadEnv()`, before validating.

Read `process.env` in exactly one place: `env.ts`.

## Rationale

Zod already validates every request, so the environment uses the same vocabulary. `Env` is inferred from the
schema, so a renamed variable breaks the build at every consumer instead of reading `undefined` in
production.

Reporting every failure at once turns eight missing variables into one cycle rather than eight. The value is
never printed because most of these are secrets, and a boot error goes to the orchestrator's log, which
usually has more readers than the database.

**Unknown variables are ignored here, and that is deliberate.** Rejecting the unknown is the rule for request
bodies; a process environment legitimately carries `PATH`, `HOME` and whatever the CI runner sets. This
exception is written down so nobody harmonises it later.

**The file is loaded by `loadEnv()` rather than by the server** because the server is not the only entry
point: the ORM's CLI reads the configuration without starting it. Node's
`--env-file` would work without code, but it has to be typed on every command. One function every entry
point calls keeps one policy, including *never in production*.

## Applies to

`src/infra/config/env.ts` and every consumer of a setting.

## Examples

```
✅  constructor(@inject(ENV) private readonly env: Env) {}
❌  const url = process.env.DATABASE_URL

✅  Invalid environment: DATABASE_URL, JWT_SECRET
❌  DATABASE_URL is invalid: postgres://admin:hunter2@prod-db/app
```

## Enforcement

**Boot.** The application does not start with an invalid environment.

**Review only.** That `.env.example` gained the variable someone added to the schema. A drifted example is
caught the next time somebody clones, because boot names everything missing.
