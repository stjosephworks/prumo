# Languages in the Vite app

## Rule

Keep one URL for every language. The screen speaks the language chosen on this browser, kept in `localStorage`;
else, signed in, the account's; else the first of the browser's own (`navigator.languages`) the project speaks; else
the base.

`I18nProvider` wraps the app in `app.tsx`, sets `<html lang>` and has zod word its refusals in the language. The
switcher sits in the root layout, on every page, before sign-in and after.

## Rationale

The app is signed in to and never indexed, so a language in the URL would add a segment to every route and every
link for no reader that needs it. A choice made here is kept here, and the account carries it to the other devices.

## Applies to

`src/i18n/`, `src/app.tsx`, `src/main.tsx`, the root layout, and `src/features/i18n/`.

## Examples

```
✅  /sign-in, in whichever language the person chose
❌  /pt-br/sign-in
```

## Enforcement

**Tests.** `test/i18n/language.spec.tsx` proves the choice, its keeping, and the account following it.
