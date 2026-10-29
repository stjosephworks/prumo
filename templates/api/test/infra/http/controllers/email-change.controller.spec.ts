import { createUser } from '@test/support/factories/user.factory'
import type { FakeMailer } from '@test/support/fakes/fake-mailer'
import { testOrm } from '@test/support/setup'
import { testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECENT_SIGN_IN_MS } from '@/domain/auth/entities/session.entity'
import { BASE_LOCALE } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

let app: FastifyInstance
let signIn: Awaited<ReturnType<typeof testApp>>['signIn']
let mailer: FakeMailer

// A native client, so the access token travels in the header and nothing depends on cookies.
async function bearer(): Promise<Record<string, string>> {
  const { response } = await signIn({ bearer: true })

  return { authorization: `Bearer ${response.json().accessToken}` }
}

const post = (url: string, headers: Record<string, string>, payload: Record<string, string>) =>
  app.inject({ method: 'POST', url: `/api/v1/users/me${url}`, headers, payload })

beforeEach(async () => {
  ;({ app, signIn, mailer } = await testApp())
})

afterEach(async () => {
  vi.useRealTimers()
  await app.close()
})

describe('changing the email', () => {
  it('sends a code to the new address, takes it, and tells the old one', async () => {
    const headers = await bearer()
    const session = await app.inject({ url: '/api/auth/session', headers })
    const previous = session.json().user.email as string | null

    const sent = await post('/email/code', headers, { email: 'new@example.com' })
    const changed = await post('/email', headers, {
      email: 'new@example.com',
      code: mailer.lastCode('new@example.com'),
    })

    expect(sent.statusCode).toBe(204)
    expect(changed.statusCode).toBe(200)
    expect(changed.json().user.email).toBe('new@example.com')

    if (previous !== null) {
      // In the account's language, which a fresh account speaks as the base.
      expect(mailer.sent.findLast((mail) => mail.to === previous)?.subject).toBe(
        messagesFor(BASE_LOCALE).mail.emailChanged.subject,
      )
    }
  })

  it("answers alike for another account's address, sends it nothing, and takes no code for it", async () => {
    const taken = 'taken@example.com'
    await createUser(testOrm().em.fork(), { email: taken })
    const headers = await bearer()
    const before = mailer.sent.length

    const sent = await post('/email/code', headers, { email: taken })
    const changed = await post('/email', headers, { email: taken, code: '123456' })

    expect(sent.statusCode).toBe(204)
    expect(mailer.sent.length).toBe(before)
    expect(changed.json()).toMatchObject({ code: 'invalid_code' })
  })

  it('asks for a sign-in of moments ago', async () => {
    const headers = await bearer()

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() + RECENT_SIGN_IN_MS + 1000))

    const refused = await post('/email/code', headers, { email: 'new@example.com' })

    expect(refused.statusCode).toBe(403)
    expect(refused.json()).toMatchObject({ code: 'reauthentication_required' })
  })
})
