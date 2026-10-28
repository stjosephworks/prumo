import { testOrm } from '@test/support/setup'
import { testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECENT_SIGN_IN_MS } from '@/domain/auth/entities/session.entity'
import { User } from '@/domain/auth/entities/user.entity'
import { Profile } from '@/domain/users/entities/profile.entity'

const BEARER = { 'x-auth-transport': 'bearer' }

let app: FastifyInstance
let signIn: Awaited<ReturnType<typeof testApp>>['signIn']

beforeEach(async () => {
  ;({ app, signIn } = await testApp())
})

afterEach(async () => {
  vi.useRealTimers()
  await app.close()
})

describe('deleting the account', () => {
  it('deletes the person, their profile and their sessions, after a sign-in of moments ago', async () => {
    const tokens = (await signIn({ bearer: true })).response.json()

    const deleted = await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    })
    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      headers: BEARER,
      payload: { refreshToken: tokens.refreshToken },
    })

    expect(deleted.statusCode).toBe(204)
    expect(refreshed.statusCode).toBe(401)
    await expect(testOrm().em.fork().count(User)).resolves.toBe(0)
    await expect(testOrm().em.fork().count(Profile)).resolves.toBe(0)
  })

  it('asks for a fresh sign-in when the last one is older than ten minutes', async () => {
    const tokens = (await signIn({ bearer: true })).response.json()

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() + RECENT_SIGN_IN_MS + 1000))

    const refused = await app.inject({
      method: 'DELETE',
      url: '/api/auth/account',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    })

    expect(refused.statusCode).toBe(403)
    expect(refused.json()).toMatchObject({ code: 'reauthentication_required' })
    await expect(testOrm().em.fork().count(User)).resolves.toBe(1)
  })

  it('refuses without a session', async () => {
    const refused = await app.inject({ method: 'DELETE', url: '/api/auth/account' })

    expect(refused.statusCode).toBe(401)
  })
})
