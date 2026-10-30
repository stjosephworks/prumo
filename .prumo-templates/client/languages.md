# A client's languages

## Rule

Read every word a screen shows from `useMessages()`, the messages of the language the screen speaks. Fill a
placeholder with `format` for text, and with `rich` where the value is an element, as an address in bold. Build a
form's schema from the messages when it words a refusal of its own (`schemaOf(messages)`, kept in `useMemo`);
zod words the rest itself, in the same language.

Send the screen's language with every request, as `Accept-Language`: the transport the app gives the contract
does it (`withLanguage`). The API answers in it, and an account created from this screen starts in it.

Keep one language per person. Signed in where nothing was chosen, the screen speaks the account's; where a language
was chosen, the account takes it (`useAccountLanguage`), so mail arrives in the language the person reads. The switcher
offers every language of the project, each in its own words, and nothing when the project speaks one.

Test in the base language: the setup leaves nothing chosen and the device asking for none, and a test finds what it
looks for by the base's messages (`test/support/messages.ts`), never by an English string.

## Rationale

The API writes its errors in `Accept-Language`, so a client that sent none would show a person an error in the base
language under a screen in theirs. The account's language decides what language mail arrives in, read later and
elsewhere, so the screen and the account agree rather than leaving the person two settings.

A test that looks for English fails in a project whose base is another language, which is every project Prumo
generated in one.

## Applies to

Every client: every component that shows a word, the transport, the switcher, and every test that finds an element by
what it says.

## Examples

```
✅  <Button>{messages.auth.signIn.submit}</Button>
❌  <Button>Sign in</Button>

✅  screen.getByRole('button', { name: messages.auth.signIn.submit })
❌  screen.getByRole('button', { name: 'Sign in' })
```

## Enforcement

**The compiler.** A message that does not exist does not build.

**Tests.** `test/i18n/` proves every language carries the base's messages and placeholders, and that the screen
switches, keeps the choice and gives it to the account.

**Review only.** That no word is written into a component.
