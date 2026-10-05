# Testing

## Rule

Run tests with Vitest, **except in `mobile`, which runs Jest with the `jest-expo` preset.** Put every test under
`test/`, at the path of the file it tests with `src/` replaced by `test/`, named `*.spec.ts`. Put what tests share
(setup, factories, fakes, a fake transport) under `test/support/`. Import code with `@/` and support with `@test/`,
never with a relative path.

**Do not mock the database.** In `api`, test a use case against an in-memory fake of its port, a class of
ours in `test/support/fakes/` that implements the port's interface. Test a repository adapter against the real
Postgres, and a route through `buildApp()` and `inject()`, also against the real Postgres.

Do not mock `EntityManager` or any concrete class from a library.

**In a client, replace the network through the injected transport**: pass a fake `fetch` to `createClient`.
Do not add a request-mocking library. Test a component that shows an error by rendering it and asserting
**where** the error appears.

Measure coverage and report it. Do not block a merge on a coverage threshold.

Assert behaviour, not execution. A test that calls a function without asserting anything is not a test.

## Rationale

`src/` holds only what ships, so a folder of product code reads as the product, and everything that exists only
to test it lives in one tree with its setup and fakes beside it. Mirroring `src/` keeps finding a test mechanical:
the path is the file's own. The aliases keep an import independent of how deep a test sits, so moving a test never
breaks one.

**What it costs:** a mirrored tree has to move when the code moves. A test left behind still passes, as an orphan
whose path no longer matches any file, and nothing reports it. Moving a file means moving its test in the same
change.
**A fake of our port is not a mock of the database.** The port is an interface we wrote, the fake
implements it, and the compiler keeps the two in step; the use case under test has no idea a database
exists. Mocking `EntityManager` would mean imitating identity map, unit of work and flush: the hardest thing
in a suite to write and the least trustworthy. Each time that imitation is wrong, the test passes and
production does not, and **a test that passes for the wrong reason is worse than no test, because it grants
permission not to look.** So the SQL is proved where it lives, in the adapter, against the real database.

A real Postgres is already provided, one per worker, with its schema built from the migrations. That also
dissolves the *unit or integration* argument every project has and nobody wins: the answer is mechanical. A
use case gets a fake, an adapter gets the database, a route gets both through the real application.

A client has no database, and a `web` generated `alone` has no API beside it to test against. The transport is
already a parameter (the integration layer takes it from the app) so a fake `fetch` needs no library and
imitates nothing internal. **What it costs:** the fake responses are written by hand and can drift from what the
API really returns, unnoticed. That is the same cost already accepted for hand-written contract types. The rules
worth testing in a client are the silent ones: an `errors` map reaching the right field, and an authentication
error becoming a form-level message.

**`mobile` is the one exception, and only the runner changes.** Expo's testing guide installs Jest with `jest-expo`,
`@testing-library/react-native` peers `jest >=29`, and the community Vitest integration for React Native has not
been published since January 2024. Every other rule here (placement, no database mocks, no threshold, asserting
behaviour) holds unchanged. **What it costs:** two runners in one workspace with near-identical APIs, so `vi.fn`
written in a mobile test is a mistake an assistant will make.

**Three things a mobile test meets, verified with Expo SDK 57:** `render` from `@testing-library/react-native` 14
is **asynchronous** and its matchers need no setup. `expo-secure-store` needs the native Keychain or Keystore,
which Jest does not have, so a test builds the auth client with an in-memory token store, which is why a form
asks only for the auth methods it calls. And `jest-expo` leaves the app manifest empty, so `expo-linking` cannot
know the app's scheme: a test that reaches `Linking.createURL` mocks it with the scheme it expects.

A coverage threshold turns a proxy into a target. Whoever is below writes tests to raise the number rather
than to check anything; whoever is above stops thinking. With no database mocks a test costs more to write,
which pushes even harder towards the cheap way of raising coverage: the test that asserts nothing.
Measuring without a threshold still answers the useful question, which is *where is there nothing at all*.

## Applies to

Every type. Anything specific to running tests against a database (containers, isolation between tests,
factories) belongs to the database area, not here.

## Examples

Placement:

```
✅  src/features/orders/order-list.tsx
    test/features/orders/order-list.spec.tsx
❌  src/features/orders/order-list.spec.tsx       beside the file
❌  test/order-list.spec.tsx                      not at the file's path

✅  import { renderApp } from '@test/support/render-app'
❌  import { renderApp } from '../../support/render-app'
```

What a test of the API uses:

```
✅  new UpdateProfileUseCase(new InMemoryProfileRepository())      a use case: our fake
✅  new MikroOrmProfileRepository(testOrm().em.fork())             an adapter: real Postgres
❌  new UpdateProfileUseCase({ findByUserId: vi.fn(), save: vi.fn() })
❌  const em = { findOne: vi.fn(), flush: vi.fn() }
```

Asserting:

```
✅  expect(await activate.execute(id)).toMatchObject({ status: 'active' })
❌  await activate.execute(id)                 // covers the line, checks nothing
```

## Enforcement

**Compiler.** A fake implements the port's interface, so a port that changes breaks every fake that no
longer matches.

**Configuration.** Each runner collects only `test/**`. That also means a spec written beside its file under
`src/` is never run, and nothing says so.

**Review only.** That a test asserts something, that a new module arrived with tests at all, that nobody
introduced a mock of a library class, that no spec sits under `src/`, and that a moved file took its test along.

**The known gap:** with no threshold, coverage can fall and CI stays green. Review is the only defence, and
review tires. If a floor is ever added, the honest form is on the diff (new code arrives tested) rather
than an average the existing code sustains.
