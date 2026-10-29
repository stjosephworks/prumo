# Languages in the Next app

## Rule

Put every page under `app/[locale]/`, whose segment is the language's tag in lowercase (`/pt-br/sign-in`), every
language prefixed, the base included. The root layout builds each page once per language (`generateStaticParams`,
`dynamicParams = false`), reads the language from the address (`localeOfPage`) and sets `<html lang>`.

A page rendered on the server reads its words with `messagesOfPage(params)`, in `generateMetadata` as in the page; a
client component reads them with `useMessages()`. Write every link and every navigation through `useLocalePath()`,
so it stays in the language in use.

`src/proxy.ts` sends an address without a language, as a typed `/sign-in` or the API's links back, to the same address
in the language chosen on this browser (the `locale` cookie the switcher writes), else the first of the browser's the
project speaks (`Accept-Language`), else the base. Switching moves to the same address in the new language.

Give every public page its address in every language, as `alternates.languages` in its metadata, keyed by
`LOCALE_INFO[locale].hreflang`, and its `canonical`. The root layout's `metadataBase` is `NEXT_PUBLIC_SITE_URL`, the
app's own address, so both come out whole, as search engines require. A page under `(auth)` or `(signed-in)` is
never indexed, and needs none.

## Rationale

A page a search engine reads needs one address per language: the language in the URL is the only way a translation
can be indexed, linked to and shared as itself. Prefixing every language, the base too, gives every route the same
shape, so a language added later moves no address.

A navigation without the prefix would reach `[locale]` with a word for a language, and no such page exists.

## Applies to

`src/app/[locale]/`, `src/proxy.ts`, `src/i18n/`, every link, every `router.push` and `router.replace`, and the
metadata of every public page.

## Examples

```
✅  router.push(localePath('/account'))
❌  router.push('/account')

✅  generateMetadata reads messagesOfPage(params) and names alternates.languages
❌  export const metadata = { title: 'Home' }
```

## Enforcement

**Tests.** `test/proxy.spec.ts` proves an address without a language reaches the chosen one, the browser's or the
base; `test/i18n/language.spec.tsx` proves switching and the account following; `test/app/page.spec.ts` proves the
home page's title and alternates in every language. `verify.mjs` checks every page is built ahead of time.
