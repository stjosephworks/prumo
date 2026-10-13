# Migrations

## Rule

Generate a migration from the entity diff, then read and edit it before committing. Treat what the
generator emits as a draft.

Run migrations as a separate pipeline step, before the new version is deployed. Never at application
boot, and never by hand.

Make every migration compatible with the **previous** release. Removing a column is two deployments:
one that stops using it, one that removes it.

Keep the `package.json` in the migrations directory. It holds only `"type": "module"`.

Delete the generated `down`. Undoing a schema change is a new migration going forward.

Keep DDL and data apart. A migration performs DDL only. Filling existing rows is a separate task, run
in batches outside the deploy path, and written so it survives running twice.

Add a column that existing rows must eventually carry as nullable first. It becomes `NOT NULL` in a
third deployment, after the backfill finishes.

## Rationale

The generator does not see a rename. It sees one column gone and another appeared, and emits
`DROP COLUMN` plus `ADD COLUMN`: correct against the diff and wrong against the intent, with no tool
able to tell the difference. Reading the SQL is also what makes migration review the real check for the
entity rules; unread, that claim has nothing behind it.

Running at boot would race N replicas against each other and put every one into a restart loop when a
migration fails. It would also mean **the process serving requests holds DDL permission**, so any
injection or compromise could drop a table. A separate step lets the deploy use a privileged user for
thirty seconds while the application runs as one that only reads and writes rows.

The migrations are TypeScript that Node loads directly, by type stripping; the build never compiles
them. They use `import`, and without a declared module type Node guesses: it fails to parse them as
CommonJS, reparses them as ES modules, and warns `MODULE_TYPELESS_PACKAGE_JSON` in every process that
runs them. The nearest `package.json` decides a file's type, so the one in the migrations directory
settles it for those files alone and leaves the CommonJS build untouched.

During a rolling deploy the previous version is still running against the new schema, so a migration
that removes something the old code reads breaks production before the new version finishes arriving.

A `down` lies. Reversing a migration that dropped a column recreates it empty: the command succeeds,
the schema returns, the data does not. And because migrations stay compatible with the previous
release, rolling back the application never required rolling back the schema in the first place.

DDL is fast and locks; a backfill is slow and does not need to. Together, the slow one inherits the
lock and the deploy waits on it.

## Applies to

Every file under the migrations directory, and the deploy pipeline.

## Examples

A rename, after editing the generated draft:

```
✅  ALTER TABLE invoice RENAME COLUMN total TO amount
❌  ALTER TABLE invoice DROP COLUMN total;
    ALTER TABLE invoice ADD COLUMN amount numeric
```

Separating the backfill:

```
✅  migration:  ALTER TABLE order ADD COLUMN status text
    task:       UPDATE order SET status = 'open' WHERE status IS NULL  -- batched
❌  migration:  ALTER TABLE order ADD COLUMN status text NOT NULL DEFAULT 'open'
```

## Enforcement

**Pipeline.** Migrations run in their own step, so the application cannot apply them and does not hold
the permission to.

**Review only, and it carries most of the weight in this area:** that the generated SQL was actually
read, that nothing in it is destructive against the previous release, and that a backfill did not get
folded into a migration. A 200-line migration is the signal that the reading became a skim, and it is
usually two migrations mixed together.
