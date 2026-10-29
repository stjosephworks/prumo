import { authFakes } from '@test/support/fakes/auth-fakes'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CODE_ATTEMPTS,
  SEND_INTERVAL_MS,
  TEXTS_PER_DAY,
} from '@/domain/auth/entities/one-time-code.entity'
import { InvalidCodeError } from '@/domain/auth/errors/invalid-code.error'
import { InvalidPhoneError } from '@/domain/auth/errors/invalid-phone.error'
import { TooManyCodesError } from '@/domain/auth/errors/too-many-codes.error'

const TYPED = '+1 (415) 555-2671'
const PHONE = '+14155552671'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-28T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

function wait(ms: number): void {
  vi.setSystemTime(new Date(Date.now() + ms))
}

describe('signing in with a phone code', () => {
  it('texts the number as E.164 and creates the account when the first code comes back', async () => {
    const { requestPhoneCode, signInWithPhoneCode, users, profiles, texts } = authFakes()

    await requestPhoneCode.execute(TYPED)
    await signInWithPhoneCode.execute({ phone: TYPED, code: texts.lastCode(PHONE), locale: 'pt' })
    const [user] = [...users.rows.values()]

    expect(user).toMatchObject({ phone: PHONE, email: null })
    expect(user?.phoneVerifiedAt).not.toBeNull()
    expect(profiles.rows.get(user?.id ?? '')).toMatchObject({
      displayName: '•••• 2671',
      locale: 'pt-BR',
    })
  })

  it('creates nothing when a code is only sent, and signs the same account in next time', async () => {
    const { requestPhoneCode, signInWithPhoneCode, users, texts } = authFakes()

    await requestPhoneCode.execute(PHONE)
    expect(users.rows.size).toBe(0)

    await signInWithPhoneCode.execute({ phone: PHONE, code: texts.lastCode(PHONE) })
    wait(SEND_INTERVAL_MS)
    await requestPhoneCode.execute(PHONE)
    await signInWithPhoneCode.execute({ phone: PHONE, code: texts.lastCode(PHONE) })

    expect(users.rows.size).toBe(1)
  })

  it('kills a code after five wrong guesses, and answers a number never texted alike', async () => {
    const { requestPhoneCode, signInWithPhoneCode, texts } = authFakes()
    await requestPhoneCode.execute(PHONE)
    const code = texts.lastCode(PHONE)

    for (let i = 0; i < CODE_ATTEMPTS; i += 1) {
      await expect(
        signInWithPhoneCode.execute({ phone: PHONE, code: '000000' }),
      ).rejects.toBeInstanceOf(InvalidCodeError)
    }

    await expect(signInWithPhoneCode.execute({ phone: PHONE, code })).rejects.toBeInstanceOf(
      InvalidCodeError,
    )
    await expect(
      signInWithPhoneCode.execute({ phone: '+14155550000', code: '123456' }),
    ).rejects.toBeInstanceOf(InvalidCodeError)
  })

  it('refuses what is no mobile number, and a country the API does not text', async () => {
    const { requestPhoneCode, texts } = authFakes()

    const landline = await requestPhoneCode.execute('+55 11 3123-4567').catch((error) => error)
    const abroad = await requestPhoneCode.execute('+44 7911 123456').catch((error) => error)

    expect(landline).toBeInstanceOf(InvalidPhoneError)
    expect(landline).toMatchObject({ code: 'invalid_phone' })
    expect(abroad).toMatchObject({ code: 'phone_not_served' })
    expect(texts.sent).toEqual([])
  })

  it('texts one number at most ten times a day, whoever asks', async () => {
    const { requestPhoneCode } = authFakes()

    for (let hour = 0; hour * 5 < TEXTS_PER_DAY; hour += 1) {
      for (let i = 0; i < 5; i += 1) {
        await requestPhoneCode.execute(PHONE)
        wait(SEND_INTERVAL_MS)
      }
      wait(60 * 60 * 1000)
    }

    await expect(requestPhoneCode.execute(PHONE)).rejects.toBeInstanceOf(TooManyCodesError)
  })

  it("lets a store reviewer's number in with its agreed code, once one was texted", async () => {
    const { requestPhoneCode, signInWithPhoneCode } = authFakes()

    await requestPhoneCode.execute('+14155550100')

    await expect(
      signInWithPhoneCode.execute({ phone: '+1 415 555 0100', code: '424242' }),
    ).resolves.toBeDefined()
  })
})
