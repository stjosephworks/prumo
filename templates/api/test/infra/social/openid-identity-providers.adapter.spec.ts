import { fakeOidcServer } from '@test/support/fake-oidc-server'
import { testEnv } from '@test/support/setup'
// One line, so its marker takes all of it.
import * as jose from 'jose' // prumo:apple
import { afterEach, describe, expect, it } from 'vitest'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error' // prumo:google
import { OpenIdIdentityProviders } from '@/infra/social/openid-identity-providers.adapter'

let server: Awaited<ReturnType<typeof fakeOidcServer>>

afterEach(async () => {
  await server.close()
})

function callback(provider: string, code: string, state: string): URL {
  return new URL(
    `http://localhost:3000/api/auth/social/${provider}/callback?code=${code}&state=${state}`,
  )
}

// prumo:google
describe('OpenIdIdentityProviders with Google', () => {
  async function google() {
    server = await fakeOidcServer({ pkce: true })

    return new OpenIdIdentityProviders(
      { ...testEnv(), GOOGLE_CLIENT_ID: 'google-client', GOOGLE_CLIENT_SECRET: 'google-secret' },
      { issuers: { google: server.issuer }, insecure: true },
    )
  }

  it('sends PKCE, state and nonce, and reads the verified profile back', async () => {
    const providers = await google()
    const redirect = await providers.redirect('google', 'state-1')
    const url = new URL(redirect.url)
    const code = server.authorize(redirect.url, {
      sub: 'g-1',
      email: 'ana@example.com',
      email_verified: true,
      name: 'Ana',
    })

    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/auth/social/google/callback',
    )

    const profile = await providers.profile('google', {
      callbackUrl: callback('google', code, 'state-1'),
      state: 'state-1',
      codeVerifier: redirect.codeVerifier,
      nonce: redirect.nonce,
      name: null,
    })

    expect(profile).toEqual({
      subject: 'g-1',
      email: 'ana@example.com',
      emailVerified: true,
      name: 'Ana',
    })
    expect(server.tokenRequests[0]?.get('client_secret')).toBe('google-secret')
  })

  it('refuses another state, another nonce and a code it did not issue', async () => {
    const providers = await google()
    const redirect = await providers.redirect('google', 'state-1')
    const base = {
      state: 'state-1',
      codeVerifier: redirect.codeVerifier,
      nonce: redirect.nonce,
      name: null,
    }
    const claims = { sub: 'g-1', email: 'ana@example.com', email_verified: true }

    await expect(
      providers.profile('google', {
        ...base,
        callbackUrl: callback('google', server.authorize(redirect.url, claims), 'other-state'),
      }),
    ).rejects.toBeInstanceOf(SocialSignInFailedError)
    await expect(
      providers.profile('google', {
        ...base,
        nonce: 'other-nonce',
        callbackUrl: callback('google', server.authorize(redirect.url, claims), 'state-1'),
      }),
    ).rejects.toBeInstanceOf(SocialSignInFailedError)
    await expect(
      providers.profile('google', {
        ...base,
        callbackUrl: callback('google', 'forged', 'state-1'),
      }),
    ).rejects.toBeInstanceOf(SocialSignInFailedError)
  })

  it('is not configured without its client id and secret', () => {
    expect(new OpenIdIdentityProviders(testEnv()).isConfigured('google')).toBe(false)
  })
})

// prumo:end-google
// prumo:apple
describe('OpenIdIdentityProviders with Apple', () => {
  it('signs its client secret with the .p8 key, asks for a form post, and reads "true" as verified', async () => {
    server = await fakeOidcServer({ pkce: false })
    const { privateKey, publicKey } = await jose.generateKeyPair('ES256', { extractable: true })
    const providers = new OpenIdIdentityProviders(
      {
        ...testEnv(),
        APPLE_CLIENT_ID: 'com.example.web',
        APPLE_TEAM_ID: 'TEAM123456',
        APPLE_KEY_ID: 'KEY1234567',
        // As it sits in .env: one line, its breaks written as \n.
        APPLE_PRIVATE_KEY: (await jose.exportPKCS8(privateKey)).replaceAll('\n', '\\n'),
      },
      { issuers: { apple: server.issuer }, insecure: true },
    )
    const redirect = await providers.redirect('apple', 'state-1')
    const url = new URL(redirect.url)
    const code = server.authorize(redirect.url, {
      sub: 'a-1',
      email: 'ana@privaterelay.appleid.com',
      email_verified: 'true',
    })

    expect(url.searchParams.get('response_mode')).toBe('form_post')
    expect(url.searchParams.get('code_challenge')).toBeNull()
    expect(redirect.codeVerifier).toBeNull()

    const profile = await providers.profile('apple', {
      callbackUrl: callback('apple', code, 'state-1'),
      state: 'state-1',
      codeVerifier: null,
      nonce: redirect.nonce,
      name: 'Ana Apple',
    })
    const secret = server.tokenRequests[0]?.get('client_secret') ?? ''
    const { payload } = await jose.jwtVerify(
      secret,
      await jose.importSPKI(await jose.exportSPKI(publicKey), 'ES256'),
      {
        issuer: 'TEAM123456',
        subject: 'com.example.web',
        audience: 'https://appleid.apple.com',
      },
    )

    expect(profile).toMatchObject({ subject: 'a-1', emailVerified: true, name: 'Ana Apple' })
    expect(jose.decodeProtectedHeader(secret)).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' })
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000)
  })
})
// prumo:end-apple
