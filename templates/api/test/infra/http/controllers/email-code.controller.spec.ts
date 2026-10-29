import type { FakeMailer } from '@test/support/fakes/fake-mailer'
import { ORIGIN, testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const BEARER = { 'x-auth-transport': 'bearer' }
const EMAIL = 'ana@example.com'

let app: FastifyInstance
let mailer: FakeMailer

const post = (
  url: string,
  payload: Record<string, string>,
  headers: Record<string, string> = BEARER,
) => app.inject({ method: 'POST', url, headers, payload })

beforeEach(async () => {
  ;({ app, mailer } = await testApp())
})

afterEach(async () => {
  await app.close()
})

describe('email code sign-in over HTTP', () => {
  it('sends a code to any address and signs a native client in with it', async () => {
    const sent = await post('/api/auth/email/code', { email: EMAIL })
    const signedIn = await post('/api/auth/email/sign-in', {
      email: EMAIL,
      code: mailer.lastCode(EMAIL),
    })

    expect(sent.statusCode).toBe(204)
    expect(signedIn.statusCode).toBe(200)
    expect(signedIn.json().accessToken).toEqual(expect.any(String))
  })

  it('delivers the web its cookies', async () => {
    await post('/api/auth/email/code', { email: EMAIL }, { origin: ORIGIN })

    const signedIn = await post(
      '/api/auth/email/sign-in',
      { email: EMAIL, code: mailer.lastCode(EMAIL) },
      { origin: ORIGIN },
    )

    expect(signedIn.statusCode).toBe(204)
    expect(signedIn.cookies.map((cookie) => cookie.name).sort()).toEqual([
      'access_token',
      'refresh_token',
    ])
  })

  it('answers a wrong code with invalid_code, and a second code asked too soon with 429', async () => {
    await post('/api/auth/email/code', { email: EMAIL })

    const wrong = await post('/api/auth/email/sign-in', { email: EMAIL, code: '000000' })
    const again = await post('/api/auth/email/code', { email: EMAIL })

    expect(wrong.statusCode).toBe(422)
    expect(wrong.json()).toMatchObject({ code: 'invalid_code' })
    expect(again.statusCode).toBe(429)
    expect(Number(again.headers['retry-after'])).toBeGreaterThan(0)
  })
})
