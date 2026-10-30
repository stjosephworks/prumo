import { describe, expect, it } from 'vitest'
import { chosenLocale, keepChoice, pathIn, sendToLanguage } from '@/i18n/choice'
import { BASE_LOCALE, LOCALES, segmentOf } from '@/i18n/locales'
import { navigate } from '@/lib/navigate'

// Any language of the project's other than the base, or the base when it speaks one.
const other = LOCALES.find((locale) => locale !== BASE_LOCALE) ?? BASE_LOCALE

describe('an address without a language', () => {
  it('goes to the same address in the browser’s language, keeping what it asked for', () => {
    Object.defineProperty(navigator, 'languages', { value: ['x-none', other], configurable: true })
    window.history.replaceState(null, '', '/sign-in?error=social_sign_in_failed')

    sendToLanguage()

    expect(navigate.replace).toHaveBeenCalledWith(
      `/${segmentOf(other)}/sign-in?error=social_sign_in_failed`,
    )
  })

  it('prefers the language chosen here, and falls back to the base', () => {
    keepChoice(other)
    window.history.replaceState(null, '', '/')
    sendToLanguage()

    localStorage.clear()
    sendToLanguage()

    expect(chosenLocale()).toBeUndefined()
    expect(navigate.replace).toHaveBeenNthCalledWith(1, `/${segmentOf(other)}`)
    expect(navigate.replace).toHaveBeenNthCalledWith(2, `/${segmentOf(BASE_LOCALE)}`)
  })

  it('swaps the language of an address that names one', () => {
    expect(pathIn(other, `/${segmentOf(BASE_LOCALE)}/account`)).toBe(`/${segmentOf(other)}/account`)
  })
})
