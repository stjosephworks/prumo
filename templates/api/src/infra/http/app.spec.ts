import { describe, expect, it } from 'vitest'
import { createContainer } from '@/infra/di'
import { buildApp } from '@/infra/http/app'
import { testEnv, testOrm } from '../../../test/setup'

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
