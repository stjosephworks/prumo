# Queries

## Rule

Query only inside a repository adapter in `src/infra/database/mikroorm/repositories/`. It injects the
`EntityManager`; read with `em.find` and `em.findOne`, write with `em.persist` and `em.flush`. Do not use
MikroORM's `EntityRepository`: the port is ours.

Give a port one method per question the domain asks, named for it: `findByUserId`, not a generic `find`
taking a filter.

State `populate` on every read that needs a relation, and access a relation only through `$`.

Reach for the QueryBuilder only where the operation does not exist in `em.find`: aggregation, window
functions, CTEs, upserts. Reach for raw SQL only where the QueryBuilder cannot express it either. Write one
comment line saying why, at each step down.

Apply the tenant rules to raw SQL exactly as to everything else.

Return the managed entity from the repository. Only the use cases of the module that owns an entity change
it.

## Rationale

The adapter is the only file that knows the database, so a use case reads as the product's rule and its
test replaces the adapter with a fake. A method per question keeps the port honest: a generic filter would
leak the ORM's query language into the domain, and the fake would have to reimplement it.

`EntityRepository` is refused because it would be a second repository beside ours, with the same name and a
different contract.

`Ref` and `$` turn N+1 from a review item into a compile error, because `Loaded<Entity, Hints>` tracks what
was populated. N+1 is the most silent database defect there is: the page works and merely gets slower as the
list grows.

The comment on a lower-level query exists because a year later nobody can tell whether it is there because
it was needed or because the author did not know how to express it otherwise.

An entity from `em.find` is managed, so changing it and flushing writes it with no `persist` call. That is
the Unit of Work, accepted deliberately. The ownership rule keeps a change made for display from becoming a
write when something downstream flushes.

## Applies to

Every repository adapter and every port. The relation rules also shape how entities are declared.

## Examples

```
✅  findByUserId(userId: string): Promise<Profile | null>
❌  find(filter: FilterQuery<Profile>)            the ORM's language in the domain

✅  em.findOne(Order, id, { populate: ['customer'] })   then order.customer.$.name
❌  em.findOne(Order, id)                               then order.customer.$.name: does not compile

✅  // QueryBuilder: needs a window function, which em.find cannot express
❌  (no comment)
```

## Enforcement

**Compiler.** Reading `$` on an unpopulated relation does not typecheck.

**Review only.** That queries stay in the adapters, that each step down the query ladder carries its reason,
and that nothing outside the owning module's use cases changes an entity. The last one fails silently: a
change made for display becomes a write on the next flush of that request.
