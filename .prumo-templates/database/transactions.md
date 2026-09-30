# Transactions

## Rule

Open a transaction only where more than one write must succeed or fail together. A single `save()` is
already atomic.

Open it in the use case, through the `TransactionManager` port: `await this.transactions.run(async () => …)`.
Every repository called inside the callback joins the transaction. Never write `begin` / `commit` /
`rollback` by hand.

Keep every network call outside the callback: an email, a payment gateway, any HTTP request.

Leave the isolation level at READ COMMITTED. Where an invariant depends on reading a row and then deciding,
lock it: give the port a method that says so, `findByIdForUpdate`, and implement it with
`lockMode: LockMode.PESSIMISTIC_WRITE`. Do not raise the isolation level.

Do not retry a failed transaction. Fix the lock ordering instead.

## Rationale

The boundary is the use case's decision, because only the use case knows which writes belong together; the
port keeps that decision in the domain without importing the ORM. The adapter uses `em.transactional`, and
inside it the global `EntityManager` resolves to the transaction's fork, which is why repositories need
nothing passed to them.

A per-request transaction would last as long as the request, so a five-second timeout at an email provider
becomes five seconds of row locks; under concurrency that becomes a queue and the queue an outage.

READ COMMITTED does not prevent read-decide-write: two requests read the same balance, both find it
sufficient, and both write. Nothing fails. `FOR UPDATE` is the local, visible fix: the second transaction
waits instead of aborting, so it needs no retry. The lock is a named port method so the use case shows it.

A deadlock is an ordering bug, and retrying hides it. A retry also repeats whatever side effects already
happened outside the database.

## Applies to

Every use case that writes more than once, and `MikroOrmTransactionManager`.

## Examples

```
✅  await this.transactions.run(async () => { … })
    await this.mailer.send(…)
❌  await this.transactions.run(async () => { … ; await this.mailer.send(…) })

✅  const account = await this.accounts.findByIdForUpdate(id)
❌  const account = await this.accounts.findById(id)     two requests both pass the check
```

## Enforcement

**Tests.** The template proves that a failed write inside `run()` rolls back the one before it.

**Review only, and one line of it matters more than anything else in this area:** that a read-decide-write
sequence locks the row. Nothing detects a missing lock, and no transaction errors when a balance goes
negative. Also review that no network call sits inside `run()` and that nobody added a retry.
