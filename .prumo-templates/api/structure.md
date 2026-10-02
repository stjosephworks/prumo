# Structure

## Rule

Split `src/` into two layers. `src/domain` holds what the product is: entities, ports, use cases, DTOs and
errors. `src/infra` holds how it runs: configuration, auth, the database adapters, the HTTP edge and the
dependency container.

Import nothing from `src/infra`, from the ORM or from the HTTP framework inside `src/domain`. The domain
imports `zod` for its DTOs and `tsyringe` for its decorators, and nothing else outside itself, except by
name: an entity declaring a relation imports `Ref`, `ref` and `Collection` from `@mikro-orm/core`, and
nothing more.

Create one module per resource under `src/domain`: `users`, `orders`, `invoices`. A module holds only these
folders, each created with its first file:

| Folder | Holds | File |
|---|---|---|
| `entities/` | A plain class with the data and the behaviour of one entity | `<name>.entity.ts` |
| `repositories/` | The port to persistence: an interface and its `Symbol` token, in one file | `<name>.repository.ts` |
| `ports/` | Any other port, such as a password hasher or a token signer: an interface and its `Symbol` token | `<name>.port.ts` |
| `use-cases/` | One class per use case, with one `execute()` method | `<verb>-<noun>.use-case.ts` |
| `dto/` | Zod schemas and their inferred types, input and output | `<name>.dto.ts` |
| `errors/` | Classes extending `DomainError` | `<name>.error.ts` |
| `services/` | A pure function spanning several entities of the module | `<name>.service.ts` |

Put logic about one entity in a method of that entity. Put logic spanning several in an exported function
under `services/`. A pure function is imported directly and never registered in the container.

For every port, write its adapter under `src/infra` and register it in `src/infra/di/<module>.di.ts`, which
`src/infra/di/index.ts` calls.

Name every file with its role suffix, including where the folder already says it.

Reach another module only through its use cases: inject the use case class. A module's ports are its own;
no other module injects them.

Two modules never depend on each other in both directions, and neither do two use cases. When they appear
to, move the common part into a third module named for what it does. Do not use tsyringe's `delay()`.

Do not write barrel files. An `index.ts` that holds code of its own, as `src/infra/di/index.ts` does, is not
one.

Put in `src/domain/shared/` only a primitive every module uses or a second module has come to need, in a
folder named for its role: `errors/`, `transactions/`. A capability with a name of its own, such as
`notifications`, `pdf` or `storage`, is a module, not a shared file.

## Rationale

The layers exist so the rules can be read and tested without a database or a server. A use case receives
its ports through the constructor, so its test hands it an in-memory fake; nothing about Postgres or
Fastify is needed to prove a rule of the product. The rule is kept by convention rather than by a checker,
a choice made knowingly: the one checker considered was measured once producing a useless file to satisfy
itself.

One class per use case keeps each constructor to what that case needs. A service per module accumulates
the dependencies of every case in one constructor and grows without a limit.

The suffix is always written because the same name lives in several layers. `update-profile` is both a
DTO and a use case; `profile` is an entity, a schema, a port and an adapter. Without the suffix, an editor
shows four tabs named `profile.ts` and a file search cannot tell them apart. A rule of *suffix where it
collides* would need judging at every new file and would rename old files when a new one arrived.

Reaching another module through its use cases means the module that owns an entity is the only one that
writes it, so its rules cannot be bypassed from outside. A cycle is refused because tsyringe's answer to
one, `delay()`, is presented in its own documentation as the way out of an `undefined constructor` error:
a patch over a design already in a loop. Barrel files are refused because they are how an invisible cycle
forms: a file imports the index that imports it back.

A folder exists only with its first file because Git does not keep an empty one, and a folder waiting to
be filled is filled for its own sake. `domain/shared/` has an admission test because a shared folder
without one only grows; requiring a role for each folder forces the question *what is this*.

**What this costs:** a module that is large and still one thing gets many files, one per use case. And
nothing but review keeps the domain free of the infrastructure.

## Applies to

Every file under `src/` of the API. The rules about reaching across modules apply wherever one module's
code refers to another's.

## Examples

The layers:

```
✅  src/domain/orders/use-cases/create-order.use-case.ts   imports @/domain/…
❌  src/domain/orders/use-cases/create-order.use-case.ts   imports @mikro-orm/core
```

A module:

```
✅  domain/users/entities/profile.entity.ts
    domain/users/repositories/profile.repository.ts        interface + PROFILE_REPOSITORY
    domain/users/use-cases/update-profile.use-case.ts
    domain/users/dto/update-profile.dto.ts
✅  domain/auth/ports/password-hasher.port.ts              interface + PASSWORD_HASHER
❌  domain/auth/repositories/password-hasher.repository.ts  stores nothing
❌  domain/users/users.service.ts                           every case in one class
❌  domain/users/profile.ts                                 no role suffix
```

Reaching another module:

```
✅  constructor(private readonly findProfile: FindProfileUseCase) {}
❌  constructor(@inject(PROFILE_REPOSITORY) private readonly profiles: ProfileRepository) {}   from orders
❌  constructor(@inject(delay(() => CreateOrderUseCase)) …)
```

Where logic goes:

```
✅  profile.update(changes)                      one entity
✅  domain/orders/services/order-total.service.ts   several entities
❌  a private function copied into two use cases
```

Importing:

```
✅  import { FindProfileUseCase } from '@/domain/users/use-cases/find-profile.use-case'
❌  import { FindProfileUseCase } from '@/domain/users'
```

## Enforcement

**Lint.** Biome's `noBarrelFile`, enabled in the API's `biome.jsonc`, refuses a file that re-exports.

**Review only.** Everything else. Nothing checks that the domain imports no infrastructure, that a module
maps to a resource, that another module is reached through its use cases, that no cycle has formed, or
that `domain/shared/` admits only primitives; a reviewer does.
