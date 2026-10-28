import { testEnv, testOrm } from '@test/support/setup'
import { describe, expect, it } from 'vitest'
import { createContainer } from '@/infra/di'
import { buildApp } from '@/infra/http/app'

describe('buildApp', () => {
  it('refuses a versioned route that declares no response schema', async () => {
    const app = await buildApp(createContainer({ env: testEnv(), orm: testOrm() }))

    await expect(
      app.register(
        async (scope) => {
          scope.get('/leak', async () => ({ secret: true }))
        },
        { prefix: '/api/v1' },
      ),
    ).rejects.toThrow('GET /api/v1/leak declares no response schema')

    await app.close()
  })
})

describe('TRUST_PROXY', () => {
  // The address a request is counted under by the rate limits, and logged with.
  async function addressSeen(trustProxy: boolean | string[]): Promise<string> {
    const app = await buildApp(
      createContainer({ env: { ...testEnv(), TRUST_PROXY: trustProxy }, orm: testOrm() }),
    )

    app.get('/address', { config: { public: true } }, async (request) => request.ip)

    const response = await app.inject({
      url: '/address',
      headers: { 'x-forwarded-for': '203.0.113.7' },
    })

    await app.close()
    return response.body
  }

  it('ignores X-Forwarded-For by default: the client cannot pick its own address', async () => {
    expect(await addressSeen(false)).toBe('127.0.0.1')
  })

  it('reads the client from X-Forwarded-For when the request came through a trusted proxy', async () => {
    expect(await addressSeen(['127.0.0.1'])).toBe('203.0.113.7')
  })
})
