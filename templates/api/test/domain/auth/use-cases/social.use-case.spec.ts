import { socialFakes } from '@test/support/fakes/social-fakes'
import { describe, expect, it } from 'vitest'
import { ProviderEmailUnverifiedError } from '@/domain/auth/errors/provider-email-unverified.error'
import { ProviderNotConfiguredError } from '@/domain/auth/errors/provider-not-configured.error'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'

const ANA = { name: 'Ana', email: 'ana@example.com', password: 'correct-horse-battery' }
const GOOGLE = {
  subject: 'google-sub-1',
  email: 'Ana@Example.com',
  emailVerified: true,
  name: 'Ana G',
}

describe('LinkIdentityUseCase', () => {
  it('creates a verified, password-less account with its profile for someone new', async () => {
    const { linkIdentity, users, profiles, identities } = socialFakes()

    const userId = await linkIdentity.execute('google', GOOGLE)
    const user = users.rows.get(userId)

    expect(user).toMatchObject({ email: 'ana@example.com', passwordHash: null })
    expect(user?.emailVerifiedAt).not.toBeNull()
    expect(profiles.rows.get(userId)).toMatchObject({ displayName: 'Ana G' })
    expect(identities.rows).toEqual([expect.objectContaining({ provider: 'google', userId })])
  })

  it('recognises the provider account the next time, by subject even if the email changed', async () => {
    const { linkIdentity } = socialFakes()

    const first = await linkIdentity.execute('google', GOOGLE)
    const again = await linkIdentity.execute('google', { ...GOOGLE, email: 'new@example.com' })

    expect(again).toBe(first)
  })

  it('links to a confirmed account and leaves its password alone', async () => {
    const { register, linkIdentity, users, signIn } = socialFakes()
    await register(ANA)
    // Confirmed by a code where the project verifies emails; marked here so the rule is proved either way.
    for (const user of users.rows.values()) {
      user.verifyEmail(new Date())
    }

    const userId = await linkIdentity.execute('google', GOOGLE)

    expect(users.rows.get(userId)?.passwordHash).toBe('hashed:correct-horse-battery')
    await expect(signIn.execute(ANA)).resolves.toBeDefined()
  })

  // The attack: someone signs up with another person's email first, and waits for them to arrive by Google.
  it('takes an unconfirmed account from whoever chose its password, ending their sessions', async () => {
    const { signUp, linkIdentity, users, sessions } = socialFakes()
    await signUp.execute(ANA)
    const squatter = [...users.rows.values()][0]

    const userId = await linkIdentity.execute('google', GOOGLE)

    expect(userId).toBe(squatter?.id)
    expect(users.rows.get(userId)?.passwordHash).toBeNull()
    expect([...sessions.rows.values()].every((session) => session.revokedAt !== null)).toBe(true)
  })

  it('refuses an email the provider has not verified', async () => {
    const { linkIdentity } = socialFakes()

    await expect(
      linkIdentity.execute('google', { ...GOOGLE, emailVerified: false }),
    ).rejects.toBeInstanceOf(ProviderEmailUnverifiedError)
  })
})

describe('a social sign-in, start to session', () => {
  it('signs the web in on return, and only the browser that started', async () => {
    const { start, complete } = socialFakes()
    const { url, browserToken } = await start.execute({
      provider: 'google',
      client: 'web',
      returnTo: '/orders',
    })
    const state = new URL(url).searchParams.get('state') ?? ''
    const callback = {
      provider: 'google' as const,
      state,
      callbackUrl: new URL('http://localhost:3000/cb'),
      name: null,
    }

    await expect(complete.execute({ ...callback, browserToken: undefined })).rejects.toBeInstanceOf(
      SocialSignInFailedError,
    )

    const outcome = await complete.execute({ ...callback, browserToken })

    expect(outcome).toMatchObject({ client: 'web', returnTo: '/orders' })
    await expect(complete.execute({ ...callback, browserToken })).rejects.toBeInstanceOf(
      SocialSignInFailedError,
    )
  })

  it('gives a mobile app a code it can exchange once', async () => {
    const { start, complete, exchange } = socialFakes()
    const { url, browserToken } = await start.execute({
      provider: 'apple',
      client: 'mobile',
      returnTo: '/',
    })
    const outcome = await complete.execute({
      provider: 'apple',
      state: new URL(url).searchParams.get('state') ?? '',
      browserToken,
      callbackUrl: new URL('http://localhost:3000/cb'),
      name: 'Ana',
    })

    if (outcome.client !== 'mobile') {
      throw new Error('expected a code for the mobile app')
    }

    await expect(exchange.execute(outcome.code)).resolves.toBeDefined()
    await expect(exchange.execute(outcome.code)).rejects.toBeInstanceOf(SocialSignInFailedError)
  })

  it('refuses a provider without credentials, and a callback for another provider', async () => {
    const { start, complete, providers } = socialFakes()
    const { url, browserToken } = await start.execute({
      provider: 'google',
      client: 'web',
      returnTo: '/',
    })

    await expect(
      complete.execute({
        provider: 'apple',
        state: new URL(url).searchParams.get('state') ?? '',
        browserToken,
        callbackUrl: new URL('http://localhost:3000/cb'),
        name: null,
      }),
    ).rejects.toBeInstanceOf(SocialSignInFailedError)

    Object.assign(providers, { configured: [] })

    await expect(
      start.execute({ provider: 'google', client: 'web', returnTo: '/' }),
    ).rejects.toBeInstanceOf(ProviderNotConfiguredError)
  })
})
