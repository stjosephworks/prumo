import { FakeIdentityProviders } from '@test/support/fakes/social-fakes'
import { testEnv, testOrm } from '@test/support/setup'
import { testApp } from '@test/support/test-app'
import type { FastifyInstance, LightMyRequestResponse } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { User } from '@/domain/auth/entities/user.entity' // prumo:apple
import { IDENTITY_PROVIDERS } from '@/domain/auth/ports/identity-providers.port'

const WEB = 'http://localhost:5173'
const BACKOFFICE = 'http://localhost:5174'

// Whichever provider the project kept: the flow is the same for each.
const PROVIDER = [
  'google', // prumo:google
  'apple', // prumo:apple
][0]

let app: FastifyInstance

function browserCookie(response: LightMyRequestResponse): string {
  const cookie = response.cookies.find((each) => each.name === 'social_sign_in')
  return `social_sign_in=${cookie?.value ?? ''}`
}

function stateOf(response: LightMyRequestResponse): string {
  return new URL(response.headers.location as string).searchParams.get('state') ?? ''
}

beforeEach(async () => {
  ;({ app } = await testApp({
    env: { ...testEnv(), WEB_ORIGIN: [WEB, BACKOFFICE], MOBILE_APP_SCHEME: 'acme' },
    configure: (container) =>
      container.register(IDENTITY_PROVIDERS, { useValue: new FakeIdentityProviders() }),
  }))
})

afterEach(async () => {
  await app.close()
})

describe('social sign-in on the web', () => {
  it('sends the browser to the provider and back into the app, signed in', async () => {
    const started = await app.inject({ url: `/api/auth/social/${PROVIDER}?returnTo=/orders` })
    const back = await app.inject({
      url: `/api/auth/social/${PROVIDER}/callback?code=c&state=${stateOf(started)}`,
      headers: { cookie: browserCookie(started) },
    })

    expect(started.statusCode).toBe(302)
    expect(started.headers.location).toMatch(/^https:\/\/\w+\.test\/authorize/)
    expect(back.statusCode).toBe(302)
    expect(back.headers.location).toBe(`${WEB}/orders`)
    expect(back.cookies.map((cookie) => cookie.name)).toEqual(
      expect.arrayContaining(['access_token', 'refresh_token']),
    )
  })

  it('refuses a return without the browser that started it, and a foreign returnTo', async () => {
    const started = await app.inject({
      url: `/api/auth/social/${PROVIDER}?returnTo=//evil.example`,
    })
    const forwarded = await app.inject({
      url: `/api/auth/social/${PROVIDER}/callback?code=c&state=${stateOf(started)}`,
    })
    const back = await app.inject({
      url: `/api/auth/social/${PROVIDER}/callback?code=c&state=${stateOf(started)}`,
      headers: { cookie: browserCookie(started) },
    })

    expect(forwarded.headers.location).toBe(`${WEB}/sign-in?error=social_sign_in_failed`)
    expect(back.headers.location).toBe(`${WEB}/`)
  })

  it('sends each web app back to itself, and refuses an origin it does not trust', async () => {
    const started = await app.inject({
      url: `/api/auth/social/${PROVIDER}?returnTo=/orders&origin=${encodeURIComponent(BACKOFFICE)}`,
    })
    const back = await app.inject({
      url: `/api/auth/social/${PROVIDER}/callback?code=c&state=${stateOf(started)}`,
      headers: { cookie: browserCookie(started) },
    })
    const failed = await app.inject({
      url: `/api/auth/social/${PROVIDER}/callback?error=access_denied`,
      headers: { cookie: browserCookie(started) },
    })
    const foreign = await app.inject({
      url: `/api/auth/social/${PROVIDER}?origin=${encodeURIComponent('https://evil.example')}`,
    })

    expect(back.headers.location).toBe(`${BACKOFFICE}/orders`)
    expect(failed.headers.location).toBe(`${BACKOFFICE}/sign-in?error=social_sign_in_failed`)
    expect(foreign.statusCode).toBe(422)
  })

  it('turns a form post, as Apple sends, into a redirect the browser’s cookie comes with', async () => {
    const posted = await app.inject({
      method: 'POST',
      url: `/api/auth/social/${PROVIDER}/callback`,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'code=c&state=s&user=%7B%7D',
    })

    expect(posted.statusCode).toBe(303)
    expect(posted.headers.location).toBe(
      `http://localhost:3000/api/auth/social/${PROVIDER}/callback?code=c&state=s&user=%7B%7D`,
    )
  })
})

describe('social sign-in on mobile', () => {
  it('sends the app a code, which it trades once for its tokens', async () => {
    const started = await app.inject({ url: `/api/auth/social/${PROVIDER}?client=mobile` })
    const back = await app.inject({
      url: `/api/auth/social/${PROVIDER}/callback?code=c&state=${stateOf(started)}`,
      headers: { cookie: browserCookie(started) },
    })
    const location = new URL(back.headers.location as string)
    const code = location.searchParams.get('code') ?? ''
    const exchange = () =>
      app.inject({
        method: 'POST',
        url: '/api/auth/social/exchange',
        headers: { 'x-auth-transport': 'bearer' },
        payload: { code },
      })

    expect(`${location.protocol}//${location.host}`).toBe('acme://social')
    expect((await exchange()).json().accessToken).toEqual(expect.any(String))
    expect((await exchange()).statusCode).toBe(401)
  })
})

// prumo:apple
describe('deleting an account that signs in with Apple, over HTTP', () => {
  it('asks for Apple, sends the browser there with a link, and deletes on the way back', async () => {
    const providers = new FakeIdentityProviders()
    providers.next = {
      subject: 'apple-sub-1',
      email: 'ana@privaterelay.appleid.com',
      emailVerified: true,
      name: null,
    }
    const own = await testApp({
      env: { ...testEnv(), WEB_ORIGIN: [WEB] },
      configure: (container) => container.register(IDENTITY_PROVIDERS, { useValue: providers }),
    })
    const signingIn = await own.app.inject({ url: '/api/auth/social/apple' })
    const signedIn = await own.app.inject({
      url: `/api/auth/social/apple/callback?code=c&state=${stateOf(signingIn)}`,
      headers: { cookie: browserCookie(signingIn) },
    })
    const session = {
      cookie: signedIn.cookies.map((each) => `${each.name}=${each.value}`).join('; '),
      origin: WEB,
    }

    const refused = await own.app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
      headers: session,
    })
    const link = await own.app.inject({
      method: 'POST',
      url: '/api/auth/social/apple/deletion',
      headers: session,
      payload: { client: 'web' },
    })
    const toApple = await own.app.inject({
      url: new URL(link.json().url).pathname + new URL(link.json().url).search,
    })
    const back = await own.app.inject({
      url: `/api/auth/social/apple/callback?code=c&state=${stateOf(toApple)}`,
      headers: { cookie: browserCookie(toApple) },
    })

    expect(refused.statusCode).toBe(409)
    expect(refused.json()).toMatchObject({ code: 'provider_confirmation_required' })
    expect(toApple.headers.location).toMatch(/^https:\/\/apple\.test\/authorize/)
    expect(back.headers.location).toBe(`${WEB}/sign-in?deleted=1`)
    expect(providers.revoked).toEqual(['apple'])
    await expect(testOrm().em.fork().count(User)).resolves.toBe(0)

    await own.app.close()
  })
})
// prumo:end-apple
