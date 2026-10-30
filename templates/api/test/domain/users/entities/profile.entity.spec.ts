import { describe, expect, it } from 'vitest'
import { Profile } from '@/domain/users/entities/profile.entity'
import { BASE_LOCALE, LOCALES } from '@/i18n/locales'

describe('a new Profile', () => {
  it('speaks the language its device asked for, as the project speaks it', () => {
    for (const locale of LOCALES) {
      expect(new Profile('user', 'Ana', { locale }).locale).toBe(locale)
      expect(new Profile('user', 'Ana', { locale: locale.toLowerCase() }).locale).toBe(locale)
    }
  })

  it('speaks the base for a language the project lacks, or none', () => {
    expect(new Profile('user', 'Ana', { locale: 'x-none' }).locale).toBe(BASE_LOCALE)
    expect(new Profile('user', 'Ana').locale).toBe(BASE_LOCALE)
  })
})
