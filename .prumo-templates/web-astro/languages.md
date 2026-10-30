# Languages in the Astro app

## Rule

Put every page under `src/pages/[locale]/`, built once per language by `getStaticPaths() { return localePaths() }`,
whose segment is the language's tag in lowercase (`/pt-br/sign-in`), every language prefixed, the base included. A page
reads its language from `Astro.props.locale`, its words from `messagesFor(locale)`, and passes the language to every
island it mounts (`locale={locale}`), which `island()` hands to `I18nProvider`.

The pages are built ahead of time, so no server sends an address without a language anywhere: an address the outside
reaches without one, `/` and the API's links back (`/sign-in`, `/consent`), is a page of `language-redirect.astro`,
whose script sends the browser to the same address in the language chosen here, else the first of the browser's the
project speaks, else the base (`sendToLanguage`). Add such a page for any other address the outside links to.

The switcher is `language-switcher.astro`: links to the same page in each language, and a line of script that keeps
the choice in `localStorage` and the page's query. It is no island, so a public page stays free of React.

Give every page a search engine reads its `canonical` and its address in every language (`hreflang`), whole:
`PUBLIC_SITE_URL` is the app's own address.

## Rationale

A page a search engine reads needs one address per language, and Astro without an adapter has no server to decide
one: the language is in the address the page is built at, and the browser decides only where an address names none.

## Applies to

`src/pages/`, `src/layouts/`, `src/i18n/`, every island, every link and every `navigate` call.

## Examples

```
✅  <SignUp client:only="react" locale={locale} />
❌  <SignUp client:only="react" />

✅  navigate.to(localePath('/account'))
❌  navigate.to('/account')
```

## Enforcement

**Tests.** `test/i18n/choice.spec.ts` proves an address without a language reaches the chosen one, the browser's or
the base; `test/i18n/language.spec.tsx` proves the account following the page. `verify.mjs` checks the base's home is
built, carries its metadata and hydrates no island.
