import { ORIGIN, PASSWORD, testApp } from '@test/support/test-app'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const BEARER = { 'x-auth-transport': 'bearer' }

let app: FastifyInstance
let signUp: Awaited<ReturnType<typeof testApp>>['signUp']

function cookiesOf(response: LightMyRequestResponse): Record<string, string> {
  return Object.fromEntries(response.cookies.map((cookie) => [cookie.name, cookie.value]))
}

function setCookie(response: LightMyRequestResponse, name: string) {
  return response.cookies.find((cookie) => cookie.name === name)
}

beforeEach(async () => {
  ;({ app, signUp } = await testApp())
})

afterEach(async () => {
  await app.close()
})

describe('auth controller, on the web', () => {
  it('starts a session in httpOnly cookies, the refresh one sent only to its route', async () => {
    const { response } = await signUp()

    expect(response.body).toBe('')
    expect(setCookie(response, 'access_token')).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
      path: '/',
    })
    expect(setCookie(response, 'refresh_token')).toMatchObject({
      httpOnly: true,
      path: '/api/auth/refresh',
    })
  })

  it('reads the session from the cookie, refreshes it, and signs out', async () => {
    const { access_token, refresh_token } = cookiesOf((await signUp()).response)

    const session = await app.inject({
      url: '/api/auth/session',
      headers: { cookie: `access_token=${access_token}` },
    })
    expect(session.json()).toMatchObject({ user: { id: expect.any(String) } })

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `refresh_token=${refresh_token}`, origin: ORIGIN },
    })
    expect(refreshed.statusCode).toBe(204)
    expect(cookiesOf(refreshed).refresh_token).not.toBe(refresh_token)

    const signOut = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { cookie: `access_token=${cookiesOf(refreshed).access_token}`, origin: ORIGIN },
    })
    expect(signOut.statusCode).toBe(204)

    const afterSignOut = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: { cookie: `refresh_token=${cookiesOf(refreshed).refresh_token}`, origin: ORIGIN },
    })
    expect(afterSignOut.statusCode).toBe(401)
  })

  it('refuses a request that leans on a cookie from another origin, or from none', async () => {
    const cookie = `access_token=${cookiesOf((await signUp()).response).access_token}`

    for (const headers of [{ cookie, origin: 'https://evil.example' }, { cookie }]) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/sign-out', headers })

      expect(response.statusCode).toBe(403)
      expect(response.headers['content-type']).toContain('application/problem+json')
    }
  })
})

describe('auth controller, for a native client', () => {
  it('hands the tokens over in the body, and accepts them as a bearer', async () => {
    const { response } = await signUp({ bearer: true })
    const tokens = response.json()

    expect(response.cookies).toEqual([])
    expect(tokens).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: 900,
    })

    const session = await app.inject({
      url: '/api/auth/session',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    })
    expect(session.statusCode).toBe(200)

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: BEARER,
      payload: { refreshToken: tokens.refreshToken },
    })
    expect(refreshed.statusCode).toBe(200)
    expect(refreshed.json().refreshToken).not.toBe(tokens.refreshToken)
  })
})

describe('auth controller, refusing', () => {
  it('answers a wrong password with 401 and a taken email with 409, as problem+json', async () => {
    const { email } = await signUp({ bearer: true })

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
