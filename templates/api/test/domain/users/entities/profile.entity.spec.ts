import { describe, expect, it } from 'vitest'
import { Profile } from '@/domain/users/entities/profile.entity'

describe('Profile.localeFor', () => {
  it('keeps a supported tag, and finds one in the same language for any other', () => {
    expect(Profile.localeFor('pt-BR')).toBe('pt-BR')
    expect(Profile.localeFor('pt')).toBe('pt-BR')
    expect(Profile.localeFor('pt-PT')).toBe('pt-BR')
    expect(Profile.localeFor('en-US')).toBe('en')
  })

  it('falls back to English for a language it does not have, or none', () => {
    expect(Profile.localeFor('ja-JP')).toBe('en')
    expect(Profile.localeFor(undefined)).toBe('en')
  })
})
