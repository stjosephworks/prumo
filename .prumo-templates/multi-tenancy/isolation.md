# Isolation

## Rule

Derive the active tenant from the session. **Never from anything the client sends**: not a header, not a
path parameter, not the `Host`.

Keep organizations in the `auth` module: an `Organization` entity, and a `Membership` joining a user to one.
Store the active tenant on the `Session` row, as `active_organization_id`, and copy it into the access token as
a claim each time one is issued or refreshed. Switch tenants through one route that checks the membership,
updates the session and issues a new access token. Do not manage the active organization client-side.

Give every tenant-scoped table a `tenant_id` that is `NOT NULL` and carries a foreign key into
`organization`, with `ON DELETE RESTRICT`.

Register the MikroORM filter with `default: true` and set its parameter once per request, from the
verified access token's claim.

**Never accept `tenant_id` as a method argument.** Read it where the filter's parameter is read.

Call `qb.applyFilters()` on every QueryBuilder query. Write `WHERE tenant_id = $1` in every raw query, and
a comment saying it was checked.

Declare a route that has no tenant. **Treat an absent filter parameter as an error**, never as "no
filter".

When a membership ends, revoke that user's sessions with it, or the departed member keeps the tenant until the
access token expires.

## Rationale

The tenant is a property of who you are, not of how you asked. A client-sent tenant works, and depends on
validation existing on **every** route; forgetting once is complete cross-tenant access, and the
forgetting is invisible, because the route works perfectly for someone entitled and equally well for
someone who is not. A subdomain is input too: it arrives in a header a client controls and that proxies
rewrite, so the defence would rest on infrastructure configuration.

Keeping the active organization in the client, per tab, is a common suggestion for working in two tenants at
once. For a multi-tenant system that means the **tab** decides isolation, so it is refused here by name:
somebody will find that suggestion.

The claim is read from a token whose signature was just verified, so no request touches the database to learn
its tenant. The cost is the token's lifetime: a membership removed now still reads for up to fifteen minutes,
unless the sessions go with it, which is why the rule asks for both.

The filter is an application-level guard, and its own documentation says a raw query or a forgotten
`filters` option reads past it. It leaves three holes and they get different answers, because the problems
differ: creation is not filtered at all, the QueryBuilder needs an explicit call, and raw SQL is out of
reach. Reading `tenant_id` from the session rather than taking it as an argument removes the path by which
somebody passes the tenant of the record being read instead of the tenant of the user reading it.
`NOT NULL` does not prevent a wrong tenant; it prevents an absent one, which is the common failure.

A missing parameter must be an error because the alternative turns every resolution bug (a session that
did not load, middleware in the wrong order) into a query that returns the whole system, silently.

The foreign key exists because without it a `tenant_id` pointing nowhere inserts cleanly and passes tests,
leaving a row invisible to every filtered query. `RESTRICT` means deleting an organization with business
data fails, which is wanted: the application should decide what happens to that data rather than a cascade
deciding for it.

## Applies to

Every tenant-scoped table, every query against one, and the request pipeline that resolves the session.

**The tenantless list is closed:** authentication, the health route, third-party webhooks, and the route
listing a user's organizations. Every new route is born with a tenant, and adding to this list is a
decision rather than configuration.

## Examples

Where the tenant comes from:

```
✅  const tenantId = claims.organizationId          // from the verified access token
❌  const tenantId = req.headers['x-tenant-id']
❌  const tenantId = subdomainOf(req.headers.host)
```

Creating a row:

```
✅  create(input: CreateOrderInput)      // reads the tenant where the filter does
❌  create(input: CreateOrderInput, tenantId: string)
```

Stepping off `em.find`:

```
✅  qb.applyFilters()
    // raw: tenant filter checked
    WHERE tenant_id = $1 AND …
❌  qb.where(…).getResult()               // no filter: reads every tenant
```

## Enforcement

**Database.** `NOT NULL` rejects an absent tenant, and the foreign key rejects one that does not exist.

**Boot.** The filter is registered once with `default: true`, so `em.find` cannot opt out by omission.

**Review only, and these are the lines that matter; every one of them fails silently:**

That `applyFilters()` is present on each QueryBuilder query, and `WHERE tenant_id` on each raw one.

That no method takes a tenant as an argument.

That a route added to the tenantless list genuinely belongs there.

**Not solved here:** raw SQL remains outside the filter's reach by design. Row Level Security is the only
guarantee that survives it, and it is not adopted because its cost in this stack is unmeasured. See the
open question.
