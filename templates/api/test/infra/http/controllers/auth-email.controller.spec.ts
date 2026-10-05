import type { FakeMailer } from '@test/support/fakes/fake-mailer'
import { ORIGIN, PASSWORD, testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const BEARER = { 'x-auth-transport': 'bearer' }

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

describe('email verification over HTTP', () => {
  it('opens no session at sign-up, refuses sign-in, and signs in once the code is entered', async () => {
    const email = 'ana@example.com'
    const signUp = await post('/api/auth/sign-up', { name: 'Ana', email, password: PASSWORD })
    const refused = await post('/api/auth/sign-in', { email, password: PASSWORD })

    expect(signUp.statusCode).toBe(201)
    expect(signUp.json()).toEqual({ verificationRequired: true })
    expect(refused.statusCode).toBe(403)
    expect(refused.json()).toMatchObject({ code: 'email_not_verified' })

    await post('/api/auth/email/verification', { email })
    const verified = await post('/api/auth/email/verify', { email, code: mailer.lastCode(email) })

    expect(verified.statusCode).toBe(200)
    expect(verified.json().accessToken).toEqual(expect.any(String))
  })

  it('delivers the web its cookies once the code is entered', async () => {
    const email = 'ana@example.com'
    await post('/api/auth/sign-up', { name: 'Ana', email, password: PASSWORD }, { origin: ORIGIN })

    const verified = await post(
      '/api/auth/email/verify',
      { email, code: mailer.lastCode(email) },
      { origin: ORIGIN },
    )

    expect(verified.statusCode).toBe(204)
    expect(verified.cookies.map((cookie) => cookie.name).sort()).toEqual([
      'access_token',
      'refresh_token',
    ])
  })

  it('answers a wrong code with invalid_code, and an unknown email with 204 and no mail', async () => {
    await post('/api/auth/sign-up', { name: 'Ana', email: 'ana@example.com', password: PASSWORD })

    const wrong = await post('/api/auth/email/verify', { email: 'ana@example.com', code: '000000' })
    const unknown = await post('/api/auth/email/verification', { email: 'nobody@example.com' })

    expect(wrong.statusCode).toBe(422)
    expect(wrong.json()).toMatchObject({ code: 'invalid_code' })
    expect(unknown.statusCode).toBe(204)
    expect(mailer.sent.map((mail) => mail.to)).not.toContain('nobody@example.com')
  })
})

describe('password reset over HTTP', () => {
  it('resets the password with the mailed code and signs in with the new one', async () => {
    const email = 'ana@example.com'
    await post('/api/auth/sign-up', { name: 'Ana', email, password: PASSWORD })

    const forgot = await post('/api/auth/password/forgot', { email })
    const reset = await post('/api/auth/password/reset', {
      email,
      code: mailer.lastCode(email),
      password: 'another-good-password',
    })
    const old = await post('/api/auth/sign-in', { email, password: PASSWORD })
    const fresh = await post('/api/auth/sign-in', { email, password: 'another-good-password' })

    expect(forgot.statusCode).toBe(204)
    expect(reset.statusCode).toBe(200)
    expect(old.statusCode).toBe(401)
    expect(fresh.statusCode).toBe(200)
  })
})
