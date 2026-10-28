import type { FakeTextMessages } from '@test/support/fakes/fake-text-messages'
import { ORIGIN, testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const BEARER = { 'x-auth-transport': 'bearer' }
const PHONE = '+14155552671'

let app: FastifyInstance
let texts: FakeTextMessages

const post = (
  url: string,
  payload: Record<string, string>,
  headers: Record<string, string> = BEARER,
) => app.inject({ method: 'POST', url, headers, payload })

beforeEach(async () => {
  ;({ app, texts } = await testApp())
})

afterEach(async () => {
  await app.close()
})

describe('phone code sign-in over HTTP', () => {
  it('texts a code and signs a native client in with it, the session naming the phone', async () => {
    const sent = await post('/api/auth/phone/code', { phone: '+1 415 555 2671' })
    const signedIn = await post('/api/auth/phone/sign-in', {
      phone: PHONE,
      code: texts.lastCode(PHONE),
    })
    const session = await app.inject({
      url: '/api/auth/session',
      headers: { authorization: `Bearer ${signedIn.json().accessToken}` },
    })

    expect(sent.statusCode).toBe(204)
    expect(signedIn.statusCode).toBe(200)
    expect(session.json()).toMatchObject({ user: { phone: PHONE, email: null } })
  })

  it('delivers the web its cookies', async () => {
    await post('/api/auth/phone/code', { phone: PHONE }, { origin: ORIGIN })

    const signedIn = await post(
      '/api/auth/phone/sign-in',
      { phone: PHONE, code: texts.lastCode(PHONE) },
      { origin: ORIGIN },
    )

    expect(signedIn.statusCode).toBe(204)
    expect(signedIn.cookies.map((cookie) => cookie.name).sort()).toEqual([
      'access_token',
      'refresh_token',
    ])
  })

  it('answers a number it cannot text with 422, naming why', async () => {
    const landline = await post('/api/auth/phone/code', { phone: '+55 11 3123-4567' })
    const abroad = await post('/api/auth/phone/code', { phone: '+44 7911 123456' })

    expect(landline.statusCode).toBe(422)
    expect(landline.json()).toMatchObject({ code: 'invalid_phone' })
    expect(abroad.json()).toMatchObject({ code: 'phone_not_served' })
  })
})
