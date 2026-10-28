// A phone as a person typed it, read as the E.164 number a text is sent to. `invalid` when it is no mobile number,
// `not_served` when its country is not one the API sends texts to.
export type ReadPhone = { e164: string } | { problem: 'invalid' | 'not_served' }

export interface PhoneNumbers {
  read(input: string): ReadPhone
}

export const PHONE_NUMBERS = Symbol('PhoneNumbers')
