import { describe, expect, it } from 'vitest'
import { generateMetadata } from '@/app/[locale]/page'
import { LOCALE_INFO, LOCALES, segmentOf } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

describe('home page metadata', () => {
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
})
