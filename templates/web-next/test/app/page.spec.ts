import { describe, expect, it } from 'vitest'
import { generateMetadata } from '@/app/[locale]/page' // prumo:multi-language
// prumo:single-language
// import { metadata } from '@/app/[locale]/page'
// prumo:end-single-language
import { LOCALE_INFO, LOCALES, segmentOf } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

describe('home page metadata', () => {
  // prumo:single-language
  // it('gives search results a title, a description and the page’s address', () => {
  //   expect(metadata.title).toBe(messages.home.title)
  //   expect(String(metadata.description).length).toBeGreaterThan(0)
  //   expect(metadata.alternates?.canonical).toBe('/')
  // })
  // prumo:end-single-language
  // prumo:multi-language
  it('gives search results a title and a description in each language, and every language’s address', async () => {
    for (const locale of LOCALES) {
      const metadata = await generateMetadata({
        params: Promise.resolve({ locale: segmentOf(locale) }),
      } as never)

      expect(metadata.title).toBe(messagesFor(locale).home.title)
      expect(String(metadata.description).length).toBeGreaterThan(0)
      expect(metadata.alternates?.canonical).toBe(`/${segmentOf(locale)}`)
      expect(metadata.alternates?.languages).toEqual(
        Object.fromEntries(
          LOCALES.map((each) => [LOCALE_INFO[each].hreflang, `/${segmentOf(each)}`]),
        ),
      )
    }
  })
  // prumo:end-multi-language
})
