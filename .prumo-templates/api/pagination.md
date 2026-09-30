# Pagination

## Rule

Paginate every list endpoint by cursor. The UUID v7 primary key is the cursor.

Order by id descending. `after` means *older than this*. Do not accept a sort parameter.

Accept two query parameters in the route's `querystring` schema, a `z.strictObject`:
`limit: z.coerce.number().int().min(1).max(100).default(20)` and `after: z.uuid().optional()`.

Return `{ "data": [...], "nextCursor": "0199..." | null }`. Add nothing else: no `hasMore`, no `total`, no
nested `meta`.

Set `nextCursor` to the id of the last item on the page, or `null` when the page is the last one.

## Rationale

Offset pagination fails silently. Under concurrent inserts, page 2 repeats an item from page 1 or skips one,
with no error, and it degrades at depth, because the database counts and discards every skipped row. A cursor
is stable at any depth, and UUID v7 being time-ordered means the id already is one.

That fixes the order: `WHERE id < :cursor ORDER BY id DESC` only works over one ordering, so a sort parameter
would break the cursor without erroring.

`hasMore` is omitted because a null `nextCursor` already says it. `total` is omitted because it costs a
`COUNT` on every request, paid whether or not anyone reads it; adding it to one route later breaks no client.

The maximum lives in the schema rather than in clamping logic. Clamping would return 100 rows to a client
that asked for 500 without saying so.

## Applies to

Every endpoint returning a collection. A filter is another field of the same query schema and composes with
the cursor.

## Examples

```
✅  { "data": [ ... ], "nextCursor": "0199..." }
❌  { "data": [ ... ], "meta": { "page": 2, "total": 3204, "hasMore": true } }

✅  limit: z.coerce.number().int().min(1).max(100).default(20)
❌  limit: z.coerce.number().default(20)          no maximum: ?limit=1000000

✅  GET /api/v1/orders?limit=20&after=0199...
❌  GET /api/v1/orders?sort=total&page=3
```

## Enforcement

**Validation.** `limit`'s bounds are enforced by the schema, and an unknown parameter (`page`, `sort`,
`offset`) is rejected by `z.strictObject`.

**Review only.** That `nextCursor` is the last item's id and is null on the final page, and that a new list
endpoint paginates at all.
