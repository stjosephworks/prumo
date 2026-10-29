# Languages in the mobile app

## Rule

Speak, in this order: the language chosen in the app; else, where nothing was chosen, the account's; else the first
of the phone's own (`useLocales()` from `expo-localization`) the project speaks; else the base. "Follow the system"
is a choice too: once made, the phone's language wins over the account's, and the account takes it.

The choice is kept on the phone in MMKV (`locale`), and stays when a person signs out: it is the phone's, not the
user's. The switcher sits on the sign-in screen and the profile.

Declare the project's languages to the phone in `app.config.ts` (`SUPPORTED_LOCALES`, the `expo-localization`
plugin's `supportedLocales`), so iOS and Android 13+ offer this app's language in their own settings; the phone's
list then leads with it. A language added to the project is added there too.

## Rationale

The phone already knows a person's language, and since iOS 13 and Android 13 lets them choose one per app; the app's
own choice covers older phones and the person who wants another, and the account's covers a phone that has never been
told.

## Applies to

`src/i18n/`, `src/features/i18n/`, `app.config.ts`, the root layout and the signed-in layout.

## Examples

```
✅  <Button label={messages.auth.signIn.submit} />
❌  <Button label="Sign in" />
```

## Enforcement

**Tests.** `test/i18n/language.spec.tsx` proves the choice, its keeping, and the account following it.
`test/support/localization.ts` gives the phone no language, and `test/support/mmkv.ts` keeps MMKV in memory, so every
test speaks the base.
