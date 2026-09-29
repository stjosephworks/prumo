import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createContainer } from '@/infra/di'
import { buildApp } from '@/infra/http/app'
import { testEnv, testOrm } from '../../../../test/setup'

const ORIGIN = 'http://localhost:5173'

let app: FastifyInstance

async function signUp(): Promise<string[]> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: ORIGIN },
    payload: {
      name: 'Ana',
      email: `${crypto.randomUUID()}@example.com`,
      password: 'correct-horse-battery',
    },
  })

  expect(response.statusCode).toBe(200)

  const cookies = response.headers['set-cookie']
  return Array.isArray(cookies) ? cookies : [cookies ?? '']
}

function cookieHeader(cookies: string[]): string {
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ')
}

beforeEach(async () => {
  app = await buildApp(createContainer({ env: testEnv(), orm: testOrm() }))
})

afterEach(async () => {
  await app.close()
})

describe('users controller', () => {
  it('refuses /users/me without a session', async () => {
    const response = await app.inject({ url: '/api/v1/users/me' })

    expect(response.statusCode).toBe(401)
    expect(response.headers['content-type']).toContain('application/problem+json')
  })

  it('returns the profile created at sign-up, and only its public fields', async () => {
    const cookie = cookieHeader(await signUp())
    const response = await app.inject({ url: '/api/v1/users/me', headers: { cookie } })

    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json()).sort()).toEqual(
      ['createdAt', 'displayName', 'id', 'locale', 'timezone', 'updatedAt', 'userId'].sort(),
    )
    expect(response.json()).toMatchObject({ displayName: 'Ana', locale: 'en' })
  })

  it('updates the profile', async () => {
    const cookie = cookieHeader(await signUp())
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { cookie, origin: ORIGIN },
      payload: { timezone: 'America/Sao_Paulo' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ displayName: 'Ana', timezone: 'America/Sao_Paulo' })
  })

  it('names every rejected field, including one the schema does not know', async () => {
    const cookie = cookieHeader(await signUp())
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { cookie, origin: ORIGIN },
      payload: { displayName: '', role: 'admin' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      status: 400,
      errors: { displayName: [expect.any(String)], role: ['Unrecognized key'] },
    })
  })

  it('signs out', async () => {
    const cookie = cookieHeader(await signUp())
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { cookie, origin: ORIGIN },
    })

    expect(response.statusCode).toBe(200)
  })

  it('answers an unknown route with 404, not 401', async () => {
    const response = await app.inject({ url: '/api/v1/nothing-here' })

    expect(response.statusCode).toBe(404)
  })
})
