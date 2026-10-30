import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { BASE_LOCALE, LOCALES, segmentOf } from '@/i18n/locales'
import { proxy } from '@/proxy'

// Any language of the project's other than the base, or the base when it speaks one.
const other = LOCALES.find((locale) => locale !== BASE_LOCALE) ?? BASE_LOCALE

function visit(path: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(`http://localhost:3100${path}`, { headers }))
}

describe('proxy', () => {
  it('sends an address without a language to the browser’s, keeping what it asked for', () => {
    const response = visit('/sign-in?error=social_sign_in_failed', {
      'accept-language': `x-none, ${other}`,
    })

    expect(response.headers.get('location')).toBe(
      `http://localhost:3100/${segmentOf(other)}/sign-in?error=social_sign_in_failed`,
    )
  })

  it('prefers the language chosen here, and falls back to the base', () => {
    expect(
      visit('/', { 'accept-language': 'x-none', cookie: `locale=${other}` }).headers.get(
        'location',
      ),
    ).toBe(`http://localhost:3100/${segmentOf(other)}`)
    expect(visit('/account').headers.get('location')).toBe(
      `http://localhost:3100/${segmentOf(BASE_LOCALE)}/account`,
    )
  })

  it('lets an address that names a language through', () => {
    expect(visit(`/${segmentOf(other)}/sign-in`).headers.get('location')).toBeNull()
  })
})
