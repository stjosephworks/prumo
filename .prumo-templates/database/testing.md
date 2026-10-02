# Testing against the database

## Rule

Start one Postgres container per test run with Testcontainers. Give each Vitest worker its own database
inside it. Never point a test at a shared or long-lived database.

Build the schema by running the migrations, once per worker database. Do not use the schema generator.

Truncate every table between tests, in a single `TRUNCATE` statement listing every entity's table, read from
the ORM's metadata. Do not wrap a test in a transaction and roll it back.

Create test data with a factory per entity: a function returning a valid row from defaults and
accepting overrides. Do not keep a shared fixture file.

Pass only what the scenario depends on to a factory. Let everything else come from its defaults.

## Rationale

A real Postgres is not optional here: `uuidv7()` does not exist in a fake one, and the default that
generates every primary key would have to be stubbed away.

Vitest runs files in parallel workers, so one shared database means a worker truncating a table while
another reads it. The test then fails intermittently and people re-run until it passes, which is worse
than failing honestly. A database per worker keeps the parallelism and makes the isolation real.

The schema comes from the migrations because migrations are edited by hand, so what they produce can
diverge from what the entities describe. Building the test schema from the entities would hide exactly
that divergence: the suite would run against a schema that exists nowhere while production runs against
another.

Truncation rather than rollback, because the code under test opens its own transactions. A test already
inside one turns the code's transaction into a savepoint, which behaves differently, and a commit is
never exercised. Testing a lock inside a wrapper that will roll back tests something adjacent to the
truth.

The list comes from the metadata so that a new entity is truncated without anyone remembering to add it. Read
it as the `Map` it is: `Object.values()` on it is empty, and a suite once passed for months truncating nothing,
saved only by a cascade from tables it no longer has. A factory for a table that references a user creates the
user first, through the user's own factory.

Factories rather than a fixture file, because a fixture grows until a test depends on user number twelve
having a particular plan, and then neither can be changed alone. A factory call states what the scenario
needs and leaves the rest implied.

## Applies to

Every test that touches the database. Anything that does not (the runner, coverage, file naming, unit
test conventions) belongs to `core/testing.md`, not here.

## Examples

Stating the scenario:

```
✅  const u = await makeUser({ plan: 'trial' })
❌  const u = fixtures.users[12]
```

Cleaning up:

```
✅  TRUNCATE "user", organization, invoice
❌  TRUNCATE "user"        // fails: invoice still references it
```

## Enforcement

**Structural.** A worker cannot see another worker's data, because it cannot reach another worker's
database. Nothing has to be remembered for that to hold.

**The suite itself.** Running migrations rather than generating the schema means a wrong migration fails
a test instead of a deploy, which is what makes migration review a real check rather than a claim.

**Review only.** That a test asserts against data it created, rather than against whatever happened to
be there.

**A note that will save an hour:** with `ON DELETE RESTRICT` on every foreign key, truncating a parent
table alone fails while children exist. Truncate every table in one statement, or use `CASCADE`.
Postgres's error message does not suggest either.
