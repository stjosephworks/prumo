import { cookieHeader, ORIGIN, testApp } from '@test/support/test-app'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

let app: FastifyInstance
let signIn: Awaited<ReturnType<typeof testApp>>['signIn']

async function signedIn(): Promise<string> {
  return cookieHeader((await signIn()).response)
}

beforeEach(async () => {
  ;({ app, signIn } = await testApp())
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
    const response = await app.inject({
      url: '/api/v1/users/me',
      headers: { cookie: await signedIn() },
    })

    expect(response.statusCode).toBe(200)
    expect(Object.keys(response.json()).sort()).toEqual(
      ['createdAt', 'displayName', 'id', 'locale', 'timezone', 'updatedAt', 'userId'].sort(),
    )
    expect(response.json()).toMatchObject({
      displayName: expect.any(String),
      locale: 'en',
    })
  })

  it('updates the profile', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { cookie: await signedIn(), origin: ORIGIN },
      payload: { timezone: 'America/Sao_Paulo' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      displayName: expect.any(String),
      timezone: 'America/Sao_Paulo',
    })
  })

  it('names every rejected field, including one the schema does not know', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { cookie: await signedIn(), origin: ORIGIN },
      payload: { displayName: '', role: 'admin' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({
      status: 400,
      errors: { displayName: [expect.any(String)], role: ['Unrecognized key'] },
    })
  })

  it('signs out', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { cookie: await signedIn(), origin: ORIGIN },
    })

    expect(response.statusCode).toBe(204)
  })

  it('answers an unknown route with 404, not 401', async () => {
    const response = await app.inject({ url: '/api/v1/nothing-here' })

    expect(response.statusCode).toBe(404)
  })
})
