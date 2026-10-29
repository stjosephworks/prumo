# The API's languages

## Rule

Read the language of every request from its `Accept-Language` into `request.locale`, before anything may refuse
it (`infra/http/hooks/locale.hook.ts`): the first of its ranges that reaches one of the project's languages, else
the base. Every client sends the language its screen speaks there, on every request.

Answer in that language:

- **A refusal a person reads** names its message: a `DomainError` sets `text` to a key of `errors` in the messages,
  and `values` to what it fills in. The error handler writes `detail` from it. An error without `text` keeps its
  message as written, and is for a developer only, as OAuth's are.
- **A field's validation message** is zod's own, in the request's language: `ZOD_MESSAGES` gives zod each of the
  project's languages, and zod writes the message while the value it refused is still at hand.

Write mail and texts in the language of the account they belong to, its profile's `locale`, wherever its owner reads
them; to an address with no account, in the request's. Pass `IssueCodeUseCase` the account when the address has one
and the request's `locale` always.

Keep every text to one part, a code in it: 160 characters when every one is GSM-7, 70 once any is not, as an accent
in Portuguese or Spanish makes it.

A profile starts in the language the device asked for, as the project speaks it, else the base, which is also the
column's default.

In a workspace the API imports `@app/i18n` as the clients do, and Node runs its TypeScript by stripping the types:
the package must hold nothing but syntax that erases (`erasableSyntaxOnly`), in one file. Build the API's image from
the workspace, where the package is a link to `packages/i18n`, never from `pnpm deploy`'s output: Node refuses to
strip types under `node_modules`, and the API stops at its first import.

A new language also needs zod's messages for it in `ZOD_MESSAGES`, from `z.locales`; where zod has none, its English.

## Rationale

The request carries the language the person is reading at that moment, which is what an error must be written in.
Mail is read later, possibly elsewhere, so it follows the account; only an address with no account yet falls back to
the request, which is the only thing that speaks for its owner.

Each message is translated once, here, instead of once in every client of a workspace. A field's message comes
from zod because zod knows what was wrong with the value; writing it at validation, in the request's language,
keeps that, which the error handler could not rebuild.

Every text over one part is billed as two or more, and a single accent drops the part from 160 characters to 70.

## Applies to

`src/infra/http/hooks/locale.hook.ts`, the error handler, every `DomainError` a person can meet, every mail and text
the API sends, and the profile.

## Examples

```
✅  class InvalidCodeError … text = 'invalidCode'
❌  super('The code is wrong or has expired')

✅  issueCode.execute(target, 'sign-in', { deliver: true, account: user?.id ?? null, locale })
❌  issueCode.execute(target, 'sign-in', { deliver: true, locale: 'en' })
```

## Enforcement

**The compiler.** `text` is typed by the keys of `errors`, so an error cannot name a message that does not exist.

**Tests.** `test/infra/http/hooks/locale.hook.spec.ts` proves a refusal and zod's field messages arrive in every
language the project speaks, and the base for one it does not. `test/i18n/messages.spec.ts` proves every text fits
one part.

**Review only.** That a new refusal a person reads sets `text`, and that a new mail follows its account's language.
