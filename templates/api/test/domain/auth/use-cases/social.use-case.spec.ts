import { socialFakes } from '@test/support/fakes/social-fakes'
import { describe, expect, it } from 'vitest'
import { ProviderConfirmationRequiredError } from '@/domain/auth/errors/provider-confirmation-required.error' // prumo:apple
import { ProviderEmailUnverifiedError } from '@/domain/auth/errors/provider-email-unverified.error'
import { ProviderNotConfiguredError } from '@/domain/auth/errors/provider-not-configured.error'
import { SocialSignInFailedError } from '@/domain/auth/errors/social-sign-in-failed.error'

const ANA = { name: 'Ana', email: 'ana@example.com', password: 'correct-horse-battery' } // prumo:password
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

    expect(user).toMatchObject({ email: 'ana@example.com' })
    expect(user?.passwordHash).toBeNull() // prumo:password
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

  // prumo:password
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
  // prumo:end-password

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

    if (!('code' in outcome)) {
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

describe('signing in with a provider’s own sheet', () => {
  it('links the identity and opens a session, as a trip through the browser would', async () => {
    const { signInWithIdToken, providers, identities } = socialFakes()

    const tokens = await signInWithIdToken.execute({
      provider: 'google',
      idToken: 'id-token',
      trip: null,
      name: null,
    })

    expect(tokens.refreshToken).toEqual(expect.any(String))
    expect(providers.lastNative).toEqual({ idToken: 'id-token', nonce: null, name: null })
    expect(identities.rows).toEqual([expect.objectContaining({ subject: 'google-sub-1' })])
  })
})

// prumo:apple
const APPLE = {
  subject: 'apple-sub-1',
  email: 'ana@privaterelay.appleid.com',
  emailVerified: true,
  name: null,
}

describe('signing in with Apple’s own sheet', () => {
  it('checks the token against the nonce of its trip, and takes each trip once', async () => {
    const { issueNonce, signInWithIdToken, providers } = socialFakes()
    providers.next = APPLE
    const { trip, nonce } = await issueNonce.execute({ provider: 'apple' })
    const signIn = (sent = trip) =>
      signInWithIdToken.execute({ provider: 'apple', idToken: 'id-token', trip: sent, name: 'Ana' })

    await expect(signIn()).resolves.toBeDefined()
    expect(providers.lastNative).toEqual({ idToken: 'id-token', nonce, name: 'Ana' })
    await expect(signIn()).rejects.toBeInstanceOf(SocialSignInFailedError)
    await expect(signIn(`${trip.split('.')[0]}.forged`)).rejects.toBeInstanceOf(
      SocialSignInFailedError,
    )
  })

  it('refuses a nonce when the app cannot use Apple’s sheet', async () => {
    const { issueNonce, providers } = socialFakes()
    Object.assign(providers, { configured: [] })

    await expect(issueNonce.execute({ provider: 'apple' })).rejects.toBeInstanceOf(
      ProviderNotConfiguredError,
    )
  })
})

describe('deleting an account that signs in with Apple', () => {

  // An account Apple created, signed in, whose owner asks to delete it.
  async function linked() {
    const fakes = socialFakes()
    const userId = await fakes.linkIdentity.execute('apple', APPLE)
    const session = await fakes.signedIn('someone@example.com')

    fakes.providers.next = APPLE
    return { ...fakes, userId, sessionId: session.sessionId }
  }

  async function trip(fakes: Awaited<ReturnType<typeof linked>>) {
    const ticket = await fakes.startDeletion.execute({ userId: fakes.userId, client: 'web' })
    await fakes.resumeDeletion.execute(ticket)

    return fakes.complete.execute({
      provider: 'apple',
      state: ticket.split('.')[0] ?? '',
      browserToken: ticket,
      callbackUrl: new URL('http://localhost:3000/cb'),
      name: null,
    })
  }

  it('asks to confirm with Apple instead of deleting at once', async () => {
    const { deleteAccount, userId, sessionId, users } = await linked()

    await expect(deleteAccount.execute(userId, sessionId)).rejects.toBeInstanceOf(
      ProviderConfirmationRequiredError,
    )
    expect(users.rows.has(userId)).toBe(true)
  })

  it('revokes the Apple authorization and deletes the account once Apple confirms it', async () => {
    const fakes = await linked()

    await expect(trip(fakes)).resolves.toEqual({ client: 'web', deleted: true })
    expect(fakes.providers.revoked).toEqual(['apple'])
    expect(fakes.users.rows.has(fakes.userId)).toBe(false)
    expect(fakes.profiles.rows.has(fakes.userId)).toBe(false)
  })

  it('deletes nothing when another Apple account comes back', async () => {
    const fakes = await linked()
    fakes.providers.next = { ...APPLE, subject: 'apple-sub-2' }

    await expect(trip(fakes)).rejects.toBeInstanceOf(SocialSignInFailedError)
    expect(fakes.users.rows.has(fakes.userId)).toBe(true)
  })

  it('takes no ticket but the one it gave', async () => {
    const { startDeletion, resumeDeletion, userId } = await linked()
    const ticket = await startDeletion.execute({ userId, client: 'web' })

    await expect(resumeDeletion.execute(`${ticket.split('.')[0]}.forged`)).rejects.toBeInstanceOf(
      SocialSignInFailedError,
    )
  })

  it('deletes from the app once Apple’s own sheet confirms, revoking the code it gave', async () => {
    const fakes = await linked()
    const { trip, nonce } = await fakes.issueNonce.execute({
      provider: 'apple',
      userId: fakes.userId,
    })

    await fakes.deleteWithIdToken.execute({
      userId: fakes.userId,
      provider: 'apple',
      trip,
      idToken: 'id-token',
      code: 'code-1',
    })

    expect(fakes.providers.lastNative?.nonce).toBe(nonce)
    expect(fakes.providers.revokedCodes).toEqual(['code-1'])
    expect(fakes.users.rows.has(fakes.userId)).toBe(false)
  })

  it('revokes and deletes nothing for another Apple account, a sign-in’s trip or another account’s', async () => {
    const fakes = await linked()
    const own = await fakes.issueNonce.execute({ provider: 'apple', userId: fakes.userId })
    const signingIn = await fakes.issueNonce.execute({ provider: 'apple' })
    const someoneElses = await fakes.issueNonce.execute({ provider: 'apple', userId: 'user-2' })
    const deleteWith = (trip: string) =>
      fakes.deleteWithIdToken.execute({
        userId: fakes.userId,
        provider: 'apple',
        trip,
        idToken: 'id-token',
        code: 'code-1',
      })

    fakes.providers.next = { ...APPLE, subject: 'apple-sub-2' }

    await expect(deleteWith(own.trip)).rejects.toBeInstanceOf(SocialSignInFailedError)
    await expect(deleteWith(signingIn.trip)).rejects.toBeInstanceOf(SocialSignInFailedError)
    await expect(deleteWith(someoneElses.trip)).rejects.toBeInstanceOf(SocialSignInFailedError)
    expect(fakes.providers.revokedCodes).toEqual([])
    expect(fakes.users.rows.has(fakes.userId)).toBe(true)
  })
})
// prumo:end-apple
