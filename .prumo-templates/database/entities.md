# Entities

## Rule

Write an entity as a plain class in `src/domain/<module>/entities/<name>.entity.ts`, with its data and its
behaviour. Map it in `src/infra/database/mikroorm/entities/<name>.schema.ts` with
`new EntitySchema({ class })`, and list the schema in `mikro-orm.factory.ts`.

Import nothing from the ORM in an entity, except `Ref`, `ref` and `Collection` from `@mikro-orm/core` for a
relation. Declare a to-one relation as `Ref<T>` and a to-many one as `Collection<T>`.

Keep the default `UnderscoreNamingStrategy`. Table names are singular and match the class name; columns are
snake_case. Do not configure a naming strategy and do not set `tableName`.

Give every table `id`, `created_at` and `updated_at`. Let `id` be `uuid` with `defaultRaw: 'uuidv7()'`. Let
both timestamps be `datetime`, which is `timestamptz`, maintained by `onCreate` and `onUpdate`.

Add `tenant_id` to every tenant-scoped table. Add `deleted_at` only with a stated reason.

Map types as follows: money is `numeric`, text is `text`, JSON is `jsonb`, time is `datetime`, and an enum
is `text` with a CHECK constraint. Never `float` for money, never `string`, which is `varchar(255)`, never
`json`, never a native Postgres enum.

Index `tenant_id`, every foreign key column, and every column used to fetch a single row. Add any other
index on measurement, not on suspicion.

Declare `ON DELETE RESTRICT` on every foreign key. Use `CASCADE` only where the child cannot exist without
its parent, and say so where you use it.

## Rationale

The class is the domain's, so a use case and its test work with it without a database. The schema is the
infrastructure's, so the ORM's metadata never reaches the domain. Hydration does not call the constructor,
so a class can require its essential fields in the constructor and still be loaded from a row.

`Ref` and `Collection` are the exception because they carry the one compile-time guarantee in the area: an
unpopulated relation has no `$` on its type, so an N+1 does not compile. They also let an aggregate, an order
and its items, be written by one flush. Nothing else from the ORM is worth that exception.

snake_case is not a style choice: Postgres folds an unquoted identifier to lower case, so a camelCase column
must be quoted in every hand-written query, forever. Singular is the strategy's default.

`numeric` because floating point does not represent 0.10 exactly and the error accumulates across a sum.
`text` because it performs identically to `varchar(n)` in Postgres while adding no limit that hurts to
change. `jsonb` because `json` cannot be indexed. A CHECK rather than a native enum because removing or
reordering a native enum value requires recreating the type.

**Postgres does not index the referencing side of a foreign key**, so `order.customer_id` has no index
unless someone declares it: the most commonly forgotten index there is.

`RESTRICT` matters because deletes are real here. `CASCADE` by default would remove a customer's orders,
invoices and payments in one transaction and return success. `RESTRICT` makes that fail and forces the
decision into code.

## Applies to

Every file under `domain/<module>/entities/` and `infra/database/mikroorm/entities/`.

## Examples

```
✅  class Profile { … }                        no ORM import
❌  class Profile extends ProfileSchema.class   the schema leaks into the domain

✅  customer: Ref<Customer>      items = new Collection<OrderItem>(this)
❌  customer: Customer           an unpopulated relation looks loaded

✅  displayName: { type: 'text' }
❌  displayName: { type: 'string' }            varchar(255)

✅  class User {}      → table user, column created_at
❌  class User {}      → table users, column createdAt

✅  ON DELETE RESTRICT
❌  ON DELETE CASCADE        on customer → order
```

## Enforcement

**Compiler.** Reading `$` on an unpopulated relation does not typecheck.

**Migration review.** Every other rule here shows up as SQL in a migration, the one place a human reads the
schema as text.

**Review only.** That an entity imports nothing else from the ORM, that a new table carries the structural
columns, that a foreign key got its index, and that each `CASCADE` was deliberate.

`user` is a reserved word in Postgres: `SELECT * FROM user` returns the session user and does not error.
Quote it in hand-written SQL.
