# The tenant in a client

## Rule

Clear the **entire** query cache when the active tenant changes. Do not add the tenant to query keys.

Navigate to the tenant's root after a switch, always, even when the current route would exist in the
destination.

Show the active tenant persistently on every screen. Not inside a menu.

Never send the tenant to the API: not as a header, not as a parameter. The server derives it.

Never read the tenant from local storage or from a cached response to decide what to display.

## Rationale

The query-key rule already says a key includes everything that changes the result, and the tenant changes
the result. **But the tenant is invisible to whoever writes the query:** the server derives it from the
access token, so the client never sends it, never passes it as a filter, and never sees it in the calling code.
Nobody remembers to put it in a key, because nothing in the file suggests it exists. Adding it everywhere
would be correct when remembered and silent when not; clearing once, in one place, does not depend on
memory.

Staying on the current route after a switch means a 404 as the first thing the user sees, answering a
question they did not ask: they asked to change company. Mapping the route back to a list works for
`/orders/abc` and lands somewhere strange for `/settings/billing/method/xyz`, and behaviour that depends
on the shape of a URL is behaviour nobody can predict. Worse, if a resource with the same id existed in
the destination, staying would open **a different record at the same URL** while the user believed nothing
had changed.

**The visible label is a safety rule, not decoration.** Whoever operates a multi-tenant system usually has
access to several tenants, and the expensive mistake is not the system leaking; it is the person acting
on the wrong tenant: deleting an order, sending an invoice, inviting somebody, in the wrong account. The
system cannot detect it, because from the API's side the request is perfectly authorised. A selector inside
a menu answers *where am I* only for someone who already suspects; whoever acts by mistake acts because
they do not.

## Applies to

Every client of a multi-tenant project: `web`, `mobile` and `site` alike.

## Examples

Switching:

```
✅  await switchTenant(organizationId)                // the API re-issues the access token
    queryClient.clear()
    router.navigate({ to: '/' })
❌  await switchTenant(organizationId)                // cache and route untouched
```

Query keys:

```
✅  ['orders', filters]
❌  ['orders', tenantId, filters]     // correct when remembered, silent when not
```

Trusting the client:

```
✅  GET /api/v1/orders
❌  GET /api/v1/orders?tenantId=…
```

## Enforcement

**Review only, and all three fail silently:**

That a switch clears the cache. Forgetting shows the previous tenant's data on the next screen, with no
error.

That nothing sends a tenant to the API. It would be ignored today, and it teaches the habit that the
client may choose.

That the active tenant is on screen. Its absence breaks nothing and costs somebody a wrong action in the
wrong account.

**Known limit:** if the session's tenant changes without this app knowing (another tab switching), this tab
keeps its access token, and its tenant, until the next refresh, and then its cache is not cleared. That follows
from the active organization living in the session, and is the cost that decision accepted.
