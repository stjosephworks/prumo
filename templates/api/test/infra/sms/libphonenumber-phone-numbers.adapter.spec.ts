import { describe, expect, it } from 'vitest'
import { LibPhoneNumbers } from '@/infra/sms/libphonenumber-phone-numbers.adapter'

describe('LibPhoneNumbers', () => {
  const phones = new LibPhoneNumbers(['US', 'BR'])

  it('reads a mobile number however it is written, as E.164', () => {
    expect(phones.read('+55 11 91234-5678')).toEqual({ e164: '+5511912345678' })
    expect(phones.read('+1 (415) 555-2671')).toEqual({ e164: '+14155552671' })
  })

  it('refuses a landline, a number without its country code, and what is no number', () => {
    for (const input of ['+55 11 3123-4567', '11 91234-5678', 'call me']) {
      expect(phones.read(input), input).toEqual({ problem: 'invalid' })
    }
  })

  // The country is the number's, not its calling code's: +44 7911 is Guernsey's, not Great Britain's.
  it('refuses a country the API does not text', () => {
    expect(phones.read('+44 7911 123456')).toEqual({ problem: 'not_served' })
  })
})
