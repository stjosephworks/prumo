import { describe, expect, it } from 'vitest'
import { BASE_LOCALE, LOCALES } from '@/i18n/locales'
import { MESSAGES } from '@/i18n/messages'

// Every message, by its path: `errors.invalidCode`.
function leaves(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') {
    return [[path, value]]
  }

  return Object.entries(value as object).flatMap(([key, nested]) =>
    leaves(nested, path === '' ? key : `${path}.${key}`),
  )
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()
}

const base = new Map(leaves(MESSAGES[BASE_LOCALE]))

// The characters a text may hold and still be sent as GSM-7, 160 to a part; any other makes it UCS-2, 70 to a part.
const GSM_7 = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà]*$/

describe('the messages of every language', () => {
  it('carry the base’s messages, no more and no fewer', () => {
    for (const locale of LOCALES) {
      expect(
        leaves(MESSAGES[locale])
          .map(([path]) => path)
          .sort(),
        locale,
      ).toEqual([...base.keys()].sort())
    }
  })

  it('name the same placeholders as the base’s, and leave none empty', () => {
    for (const locale of LOCALES) {
      for (const [path, text] of leaves(MESSAGES[locale])) {
        expect(text.trim(), `${locale} ${path}`).not.toBe('')
        expect(placeholders(text), `${locale} ${path}`).toEqual(placeholders(base.get(path) ?? ''))
      }
    }
  })

  it('send each text as one part, with its code in it', () => {
    for (const locale of LOCALES) {
      for (const [path, text] of leaves(MESSAGES[locale])) {
        if (!path.startsWith('texts.')) {
          continue
        }

        const sent = text.replaceAll('{code}', '123456')

        expect(sent.length, `${locale} ${path}`).toBeLessThanOrEqual(GSM_7.test(sent) ? 160 : 70)
      }
    }
  })
})
