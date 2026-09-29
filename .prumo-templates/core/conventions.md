# Conventions

## Rule

Name every source file in kebab-case. In `api`, add the role suffix, always: `profile.entity.ts`,
`update-profile.use-case.ts`, `update-profile.dto.ts`, `users.controller.ts`. A component is
`button.tsx`.

Write a comment only when it carries a fact the code cannot carry about itself. Before writing one, ask
whether a careful reader could recover it anyway. If they could, delete it.

Those three places are where the answer is no:

- an outside constraint: *this vendor returns 200 with the error in the body*
- code that looks wrong and is right
- something tried that does not work

Do not comment what the code says. Do not leave commented-out code. Do not write a file header, an author
tag or a change log; git holds all three.

## Rationale

kebab-case is what shadcn's CLI emits, so anything else adds a rename step after every generation, and a
correction after generation is what people forget. The suffix is always written because in `api` the same
name lives in several layers: `update-profile` is a DTO and a use case, `profile` an entity, a schema, a port
and an adapter, and without it an editor shows four tabs called `profile.ts`. kebab-case also never touches
a problem PascalCase lives with: macOS and Windows are case-insensitive, so renaming `OrderList.tsx` to
`orderList.tsx` does not register as a change in git, and the file ends up cased differently in the
repository and on a Linux clone.

The comment test exists because *comment the why, not the what* decides nothing in the moment. Every
comment looks like a why to whoever is writing it, and
`// increment the counter because we need a count` is a why and is rubbish. *Could a careful reader recover
this?* can be applied by looking at the line, which makes it a ruler rather than a principle.

The three cases are not categories to sort into. They are simply where the test answers no. An outside
constraint is not in the code at all. Code that looks wrong and is right is the only place a comment stops
somebody "fixing" it. And something tried that does not work is the information most often lost and most
expensive to rediscover.

## Applies to

Every source file, in every type.

## Examples

Naming:

```
✅  create-user.dto.ts      create-user.use-case.ts      order-list.tsx
❌  CreateUserDto.ts        create-user.ts               OrderList.tsx
```

A comment that earns its place:

```
✅  // The gateway returns 200 with the failure in the body; status is not enough.
    if (body.status !== 'ok') throw new BadGatewayException()

❌  // check if the status is not ok and throw
    if (body.status !== 'ok') throw new BadGatewayException()
```

Something tried that does not work:

```
✅  // Batching these breaks ordering: the gateway processes out of sequence.
```

## Enforcement

**Review only.** No check can judge whether a sentence carries a fact. Counting comments would be satisfied
by deleting the wrong ones, and a ratio is satisfied the same way.

**What stands in for enforcement is the code around you.** An assistant (and a new colleague) imitates the
code it reads before it obeys a document. If the files in this project carry comments that fail the test,
the rule is already dead, whatever this document says.
