# Languages

## Rule

Write every word a person reads in the app's messages, never in the component, the use case or the error that shows
it. Each app keeps them in `src/i18n/messages/`, one file per language the project speaks, named by its tag
(`en.ts`, `pt-BR.ts`, `es-419.ts`), with the keys grouped by what shows them (`errors.invalidCode`). A value names
what it fills in as `{placeholder}`, filled by `format`, never by joining strings: another language puts the value
elsewhere in the sentence.

The project's languages are one list, `LOCALES`, its **base** first. The base's messages are the shape: `Messages`
is the type of the base's file, and `MESSAGES` maps every language to its messages, so a language missing one does
not compile. The base is also what is spoken when nothing a person asks for is in the list. A tag reaches the list
by itself in any case, else by its language alone, so `pt` and `pt-PT` reach `pt-BR` and `es-AR` reaches `es-419`.

The list, its negotiation and `format` live in `src/i18n/locales.ts` in an app alone, and in the `@app/i18n` package
in a workspace, which every app imports, the API included. Messages are never shared between apps.

Add a language this way, and in no other:

1. Add its tag to `LOCALES`, and to `languages` in `.prumo/config.json`, which `prumo add` gives a new app.
2. Add its entry to `LOCALE_INFO`: what the language calls itself, and its `hreflang`.
3. In every app, copy the base's messages to `src/i18n/messages/<tag>.ts`, export them under the tag's name
   without its hyphen (`frCA` for `fr-CA`), and add them to `MESSAGES`.
4. Translate every value, keeping its placeholders.
5. Follow what each app's own area adds: the API's `api/languages.md` (zod's messages), and every client's: a mobile
   app declares the language in `app.config.ts`.

## Rationale

Words written into a component have to be found again, one by one, the day a second language arrives, and that is
the expensive part of making an app speak two: the structure costs a file per language from the start, and a
project that never adds one pays almost nothing for having it. The type checks that no language misses a message,
which is the failure that otherwise reaches a person first.

A placeholder rather than concatenation, because a sentence is ordered by its language: `{code} is your code` is
`Seu código é {code}` in another.

Prumo itself translates its templates into English, Brazilian Portuguese and Latin American Spanish, and keeps
them translated. A language beyond those is the project's, because by then its words are its own, written for
screens Prumo never saw: no tool can copy a translation of them.

## Applies to

Every app of every type: each one's `src/i18n/`, every message it shows or sends, and the list of languages wherever
it lives.

## Examples

```
✅  messages.errors.invalidCode
❌  'The code is wrong or has expired'

✅  format(messages.mail.signIn.subject, { code })
❌  `${code} is your sign-in code`
```

## Enforcement

**The compiler.** `MESSAGES` is typed by the base's messages, so a language without one of them does not build.

**Tests.** `test/i18n/messages.spec.ts` in each app proves every language carries the base's keys, no more, with the
same placeholders and none empty. `test/i18n/locales.spec.ts` proves the negotiation.

**Review only.** That a new word went into the messages rather than the code that shows it.
