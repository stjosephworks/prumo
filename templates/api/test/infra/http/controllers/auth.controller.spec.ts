import { testEnv } from '@test/support/setup'
import { ORIGIN, testApp } from '@test/support/test-app'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const BEARER = { 'x-auth-transport': 'bearer' }

let app: FastifyInstance
let signIn: Awaited<ReturnType<typeof testApp>>['signIn']

function cookiesOf(response: LightMyRequestResponse): Record<string, string> {
  return Object.fromEntries(response.cookies.map((cookie) => [cookie.name, cookie.value]))
}

function setCookie(response: LightMyRequestResponse, name: string) {
  return response.cookies.find((cookie) => cookie.name === name)
}

beforeEach(async () => {
  ;({ app, signIn } = await testApp())
})

afterEach(async () => {
  await app.close()
})

describe('auth controller, on the web', () => {
  it('starts a session in httpOnly cookies, the refresh one sent only to its route', async () => {
    const { response } = await signIn()

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
    const { access_token, refresh_token } = cookiesOf((await signIn()).response)

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
    const cookie = `access_token=${cookiesOf((await signIn()).response).access_token}`

    for (const headers of [{ cookie, origin: 'https://evil.example' }, { cookie }]) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/sign-out', headers })

      expect(response.statusCode).toBe(403)
      expect(response.headers['content-type']).toContain('application/problem+json')
    }
  })
})

describe('auth controller, with several web apps', () => {
  it('lets each of them lean on its cookie, and tells the browser so', async () => {
    const backoffice = 'http://localhost:5174'
    const several = await testApp({ env: { ...testEnv(), WEB_ORIGIN: [ORIGIN, backoffice] } })
    const cookie = `access_token=${cookiesOf((await several.signIn()).response).access_token}`
    const signedOut = await several.app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { cookie, origin: backoffice },
    })
    const preflight = await several.app.inject({
      method: 'OPTIONS',
      url: '/api/auth/sign-out',
      headers: { origin: backoffice, 'access-control-request-method': 'POST' },
    })

    expect(signedOut.statusCode).toBe(204)
    expect(preflight.headers['access-control-allow-origin']).toBe(backoffice)

    await several.app.close()
  })
})

describe('auth controller, for a native client', () => {
  it('hands the tokens over in the body, and accepts them as a bearer', async () => {
    const { response } = await signIn({ bearer: true })
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
