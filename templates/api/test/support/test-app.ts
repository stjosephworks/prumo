import { FakeMailer } from '@test/support/fakes/fake-mailer' // prumo:email
import { testEnv, testOrm } from '@test/support/setup'
import type { DependencyContainer } from 'tsyringe'
import { MAILER } from '@/domain/auth/ports/mailer.port' // prumo:email
import type { Env } from '@/infra/config/env'
import { createContainer } from '@/infra/di'
import { buildApp } from '@/infra/http/app'

export const ORIGIN = 'http://localhost:5173'
export const PASSWORD = 'correct-horse-battery'

// The application as a test meets it: the real container over the test database, with a mailer whose inbox the
// test can read.
export async function testApp({
  env = testEnv(),
  configure,
}: {
  env?: Env
  configure?: (container: DependencyContainer) => void
} = {}) {
  const container = createContainer({ env, orm: testOrm() })
  // prumo:email
  const mailer = new FakeMailer()

  container.register(MAILER, { useValue: mailer })
  // prumo:end-email
  configure?.(container)

  const app = await buildApp(container)

  // Signs up through the real routes and, where the email must be confirmed first, confirms it. Returns the
  // response that delivered the session: cookies for the web, tokens in the body for a bearer client.
  async function signUp({ bearer = false, email = `${crypto.randomUUID()}@example.com` } = {}) {
    const headers = bearer ? { 'x-auth-transport': 'bearer' } : { origin: ORIGIN }
    let response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up',
      headers,
      payload: { name: 'Ana', email, password: PASSWORD },
    })

    // prumo:email
    if (response.body.includes('verificationRequired')) {
      response = await app.inject({
        method: 'POST',
        url: '/api/auth/email/verify',
        headers,
        payload: { email, code: mailer.lastCode(email) },
      })
    }

    // prumo:end-email
    return { response, email }
  }

  return {
    app,
    signUp,
    mailer, // prumo:email
  }
}

export function cookieHeader(response: { cookies: { name: string; value: string }[] }): string {
  return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}
