import { PASSWORD, testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const BEARER = { 'x-auth-transport': 'bearer' }

let app: FastifyInstance
let signUp: Awaited<ReturnType<typeof testApp>>['signUpWithPassword']

beforeEach(async () => {
  ;({ app, signUpWithPassword: signUp } = await testApp())
})

afterEach(async () => {
  await app.close()
})

describe('password routes, refusing', () => {
  it('answers a wrong password with 401 and a taken email with 409, as problem+json', async () => {
    const { address: email } = await signUp({ bearer: true })

    const wrong = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in',
      headers: BEARER,
      payload: { email, password: 'wrong-password' },
    })
    const taken = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      headers: BEARER,
      payload: { name: 'Ana', email, password: PASSWORD },
    })

    expect(wrong.statusCode).toBe(401)
    expect(wrong.json()).toMatchObject({ detail: 'Invalid email or password' })
    expect(taken.statusCode).toBe(409)
    expect(taken.headers['content-type']).toContain('application/problem+json')
  })

  it('names the fields a sign-up gets wrong', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      headers: BEARER,
      payload: { name: '', email: 'not-an-email', password: 'short' },
    })

    expect(response.statusCode).toBe(400)
    expect(Object.keys(response.json().errors).sort()).toEqual(['email', 'name', 'password'])
  })

  it('slows down repeated sign-in attempts from one address', async () => {
    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/api/auth/sign-in',
        headers: BEARER,
        payload: { email: 'nobody@example.com', password: 'whatever' },
      })

    for (let i = 0; i < 10; i += 1) {
      expect((await attempt()).statusCode).toBe(401)
    }

    const limited = await attempt()

    expect(limited.statusCode).toBe(429)
    expect(limited.headers['content-type']).toContain('application/problem+json')
  })
})
