// The project's languages, its base first: the language every other one is checked against, and the one spoken when
// nothing a person asks for is here. `prumo new` wrote the list; .prumo/i18n/languages.md says how one is added.
//
// One file of plain TypeScript, the same in every app: in a workspace it is the `@app/i18n` package, which the API
// loads at runtime with Node's own type stripping, so nothing here may need more than types erased.
export const LOCALES = ['en', 'pt-BR', 'es-419'] as const

export type Locale = (typeof LOCALES)[number]

export const BASE_LOCALE: Locale = LOCALES[0]

type LocaleInfo = {
  // What the language calls itself, which is how a switcher names it.
  nativeName: string
  // Google accepts an ISO 639-1 language with an optional ISO 3166-1 alpha-2 region and names es-419 as unsupported
  // (https://developers.google.com/search/docs/specialty/international/localized-versions), so es-419 is `es`.
  hreflang: string
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { nativeName: 'English', hreflang: 'en' }, // prumo:en
  'pt-BR': { nativeName: 'Português (Brasil)', hreflang: 'pt-BR' }, // prumo:pt-BR
  'es-419': { nativeName: 'Español (Latinoamérica)', hreflang: 'es' }, // prumo:es-419
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

// The language a tag reaches here: the same tag in any case, else the first of the project's in the same language,
// so `pt` and `pt-PT` reach pt-BR and `es-AR` reaches es-419. A language the project lacks reaches none.
export function localeOf(tag: string): Locale | undefined {
  const wanted = tag.trim().toLowerCase()
  const language = wanted.split('-')[0]

  return (
    LOCALES.find((locale) => locale.toLowerCase() === wanted) ??
    LOCALES.find((locale) => locale.toLowerCase().split('-')[0] === language)
  )
}

// The first of the tags, best first, that reaches a language of the project's, else the base.
export function negotiateLocale(tags: readonly (string | null | undefined)[]): Locale {
  for (const tag of tags) {
    const locale = tag ? localeOf(tag) : undefined

    if (locale !== undefined) {
      return locale
    }
  }

  return BASE_LOCALE
}

// The ranges of an Accept-Language header, best first. A range with q=0 is refused, and `*` names no language.
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  return (header ?? '')
    .split(',')
    .map((part, index) => {
      const [range = '', ...parameters] = part.split(';').map((piece) => piece.trim())
      const q = parameters.find((parameter) => parameter.startsWith('q='))
      const quality = q === undefined ? 1 : Number(q.slice(2))

      return { range, quality: Number.isNaN(quality) ? 0 : quality, index }
    })
    .filter((entry) => entry.range !== '' && entry.range !== '*' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map((entry) => entry.range)
}

// The segment a language takes in a URL: its tag in lowercase, `/pt-br/`.
export function segmentOf(locale: Locale): string {
  return locale.toLowerCase()
}

export function localeOfSegment(segment: string): Locale | undefined {
  return LOCALES.find((locale) => locale.toLowerCase() === segment)
}

// A message with its `{placeholders}` filled. One the values do not name stays as written, so a missing value shows.
export function format(text: string, values: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  )
}
