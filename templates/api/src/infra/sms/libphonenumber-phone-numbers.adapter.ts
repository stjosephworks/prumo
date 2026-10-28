import { parsePhoneNumberFromString } from 'libphonenumber-js/mobile'
import type { PhoneNumbers, ReadPhone } from '@/domain/auth/ports/phone-numbers.port'

// The mobile metadata checks the digits, not only the length, and only a mobile number receives a text. It is
// pinned with the template, so a range assigned after the version was released reads as invalid until it is updated.
export class LibPhoneNumbers implements PhoneNumbers {
  constructor(private readonly countries: readonly string[]) {}

  read(input: string): ReadPhone {
    // The whole input, in international form: a number without its country code could be anyone's.
    const phone = parsePhoneNumberFromString(input, { extract: false })

    if (phone === undefined || !phone.isValid()) {
      return { problem: 'invalid' }
    }

    if (phone.country === undefined || !this.countries.includes(phone.country)) {
      return { problem: 'not_served' }
    }

    return { e164: phone.number }
  }
}
