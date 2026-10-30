import {
  BASE_LOCALE,
  format,
  isLocale,
  LOCALES,
  localeOf,
  localeOfSegment,
  negotiateLocale,
  parseAcceptLanguage,
  segmentOf,
} from '@/i18n/locales'

describe('the project’s languages', () => {
  it('reaches each of its languages from its tag in any case, or from its language alone', () => {
    for (const locale of LOCALES) {
      const language = locale.split('-')[0] ?? locale

      expect(isLocale(locale)).toBe(true)
      expect(localeOf(locale.toUpperCase())).toBe(locale)
      // The first of the project's in that language: what a bare `pt` or `es-AR` is served.
      expect(localeOf(language)).toBe(LOCALES.find((other) => other.startsWith(language)))
    }
  })

  it('reaches none for a language it lacks, and speaks the base then', () => {
    expect(localeOf('x-none')).toBeUndefined()
    expect(negotiateLocale(['x-none', undefined, null, ''])).toBe(BASE_LOCALE)
  })

  it('takes the first tag it speaks, in the order given', () => {
    const last = LOCALES.at(-1) ?? BASE_LOCALE

    expect(negotiateLocale(['x-none', last, BASE_LOCALE])).toBe(last)
  })

  it('reads Accept-Language best first, leaving out what it refuses', () => {
    expect(parseAcceptLanguage('fr;q=0.5, de, en;q=0, *;q=0.1, pt-BR;q=0.8')).toEqual([
      'de',
      'pt-BR',
      'fr',
    ])
    expect(parseAcceptLanguage(undefined)).toEqual([])
  })

  it('puts each language in a URL as its tag in lowercase, and reads it back', () => {
    for (const locale of LOCALES) {
      expect(segmentOf(locale)).toBe(locale.toLowerCase())
      expect(localeOfSegment(segmentOf(locale))).toBe(locale)
    }
    expect(localeOfSegment('x-none')).toBeUndefined()
  })

  it('fills the placeholders it is given, and shows any it is not', () => {
    expect(format('{code} expires in {minutes}', { code: '123456', minutes: 15 })).toBe(
      '123456 expires in 15',
    )
    expect(format('Hello {name}')).toBe('Hello {name}')
  })
})
