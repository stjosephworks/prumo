import { cookieHeader, ORIGIN, testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { updateProfileSchema } from '@/domain/users/dto/update-profile.dto'
import { BASE_LOCALE, LOCALES } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'
import { ZOD_MESSAGES } from '@/infra/http/hooks/locale.hook'

let app: FastifyInstance
let signIn: Awaited<ReturnType<typeof testApp>>['signIn']

beforeEach(async () => {
  ;({ app, signIn } = await testApp())
})

afterEach(async () => {
  await app.close()
})

describe('the language of an answer', () => {
  it('writes a refusal in the language the request asks for, as the project speaks it', async () => {
    for (const locale of LOCALES) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: { 'accept-language': `x-none, ${locale.toLowerCase()};q=0.8` },
      })

      expect(response.statusCode).toBe(401)
      expect(response.json().detail).toBe(messagesFor(locale).errors.invalidSession)
    }
  })

  it('writes it in the base when the request asks for nothing the project speaks', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { 'accept-language': 'x-none' },
    })

    expect(response.json().detail).toBe(messagesFor(BASE_LOCALE).errors.invalidSession)
  })

  it('has zod write each field’s message in that language, with the value it refused', async () => {
    const cookie = cookieHeader((await signIn()).response)
    const payload = { displayName: 'x'.repeat(81), role: 'admin' }

    for (const locale of LOCALES) {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/users/me',
        headers: { cookie, origin: ORIGIN, 'accept-language': locale },
        payload,
      })
      const expected = updateProfileSchema.safeParse(payload, { error: ZOD_MESSAGES[locale] })

      expect(response.json()).toMatchObject({
        detail: messagesFor(locale).errors.validationFailed,
        errors: {
          displayName: [expected.error?.issues.find((issue) => issue.code === 'too_big')?.message],
          role: [messagesFor(locale).errors.unrecognizedKey],
        },
      })
    }
  })
})
