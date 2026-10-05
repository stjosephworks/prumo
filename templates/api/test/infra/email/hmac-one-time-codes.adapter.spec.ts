import { describe, expect, it } from 'vitest'
import { HmacOneTimeCodes } from '@/infra/email/hmac-one-time-codes.adapter'

describe('HmacOneTimeCodes', () => {
  it('makes six digits, and a digest that depends on the secret', () => {
    const codes = new HmacOneTimeCodes({ JWT_SECRET: 'a'.repeat(40) })
    const other = new HmacOneTimeCodes({ JWT_SECRET: 'b'.repeat(40) })

    for (let i = 0; i < 50; i += 1) {
      expect(codes.create()).toMatch(/^\d{6}$/)
    }
    expect(codes.digest('123456')).toBe(codes.digest('123456'))
    expect(codes.digest('123456')).not.toBe(other.digest('123456'))
  })
})
