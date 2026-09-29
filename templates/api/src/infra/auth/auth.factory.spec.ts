import { describe, expect, it } from 'vitest'
import { testEnv } from '../../../test/setup'
import { createAuth } from './auth.factory'

const proxy =
  'http://localhost:3000/api/auth/expo-authorization-proxy?authorizationURL=https://example.com/authorize&oauthState=s'

describe('createAuth', () => {
  it('exposes no Expo redirect endpoint without a mobile scheme', async () => {
    const response = await createAuth(testEnv()).handler(new Request(proxy))

    expect(response.status).toBe(404)
  })

  it('exposes the Expo endpoint and trusts the scheme once a mobile scheme is set', async () => {
    const auth = createAuth({ ...testEnv(), MOBILE_APP_SCHEME: 'app' })
    const response = await auth.handler(new Request(proxy))

    expect(response.status).toBe(302)
    expect(auth.options.trustedOrigins).toContain('app://')
  })
})
