import { FakeMailer } from '@test/support/fakes/fake-mailer' // prumo:mail
import { testEnv, testOrm } from '@test/support/setup'
import type { LightMyRequestResponse } from 'fastify'
import type { DependencyContainer } from 'tsyringe'
import { MAILER } from '@/domain/auth/ports/mailer.port' // prumo:mail
import type { Env } from '@/infra/config/env'
import { createContainer } from '@/infra/di'
import { buildApp } from '@/infra/http/app'

export const ORIGIN = 'http://localhost:5173'
export const PASSWORD = 'correct-horse-battery' // prumo:password

type SignInOptions = { bearer?: boolean; email?: string }

type SignedIn = { response: LightMyRequestResponse; email: string }

async function noWayIn(): Promise<SignedIn> {
  throw new Error('This project has no way to sign in')
}

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
  // prumo:mail
  const mailer = new FakeMailer()

  container.register(MAILER, { useValue: mailer })
  // prumo:end-mail
  configure?.(container)

  const app = await buildApp(container)
  const headersFor = (bearer: boolean) =>
    bearer ? { 'x-auth-transport': 'bearer' } : { origin: ORIGIN }

  // prumo:email-code
  // Asks for a code and enters it; the first code an address enters creates its account.
  async function signInByCode({
    bearer = false,
    email = `ana.${crypto.randomUUID()}@example.com`,
  }: SignInOptions = {}): Promise<SignedIn> {
    const headers = headersFor(bearer)

    await app.inject({ method: 'POST', url: '/api/auth/email/code', headers, payload: { email } })

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/email/sign-in',
      headers,
      payload: { email, code: mailer.lastCode(email) },
    })

    return { response, email }
  }
  // prumo:end-email-code

  // prumo:password
  // Signs up through the real routes and, where the email must be confirmed first, confirms it.
  async function signUpWithPassword({
    bearer = false,
    email = `ana.${crypto.randomUUID()}@example.com`,
  }: SignInOptions = {}): Promise<SignedIn> {
    const headers = headersFor(bearer)
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
  // prumo:end-password

  // A session through the project's own way in, the first it has: the response that delivered it carries cookies
  // for the web and the tokens in its body for a bearer client.
  const [signIn = noWayIn] = [
    signInByCode, // prumo:email-code
    signUpWithPassword, // prumo:password
  ]

  return {
    app,
    signIn,
    signUpWithPassword, // prumo:password
    mailer, // prumo:mail
  }
}

export function cookieHeader(response: { cookies: { name: string; value: string }[] }): string {
  return response.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}
