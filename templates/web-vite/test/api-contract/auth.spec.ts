import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { describe, expect, it } from 'vitest'
import { type AuthClient, createAuthClient, type TokenStore, type Tokens } from '@/api-contract'

const TOKENS: Tokens = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }

function memoryStore(initial: Tokens | null = null): TokenStore & { current: Tokens | null } {
  return {
    current: initial,
    async read() {
      return this.current
    },
    async write(tokens) {
      this.current = tokens
    },
  }
}

// A sign-in through the project's own way in, the first it has; the fake API answers each.
const [signIn] = [
  // prumo:email-code
  (auth: AuthClient) => auth.signInWithCode({ email: 'ana@example.com', code: '123456' }),
  // prumo:end-email-code
  // prumo:phone-code
  (auth: AuthClient) => auth.signInWithPhoneCode({ phone: '+14155552671', code: '123456' }),
  // prumo:end-phone-code
  // prumo:password
  (auth: AuthClient) =>
    auth.signIn({ email: 'ana@example.com', password: 'correct-horse-battery' }),
  // prumo:end-password
]

describe('createAuthClient on the web', () => {
  // prumo:email-code
  it("sends the device's timezone with a code, for the account it may create, and no language", async () => {
    let body: unknown
    const auth = createAuthClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'POST /api/auth/email/sign-in': async (request) => {
          body = await request.json()
          return new Response(null, { status: 204 })
        },
      }),
    })

    await auth.signInWithCode({ email: 'ana@example.com', code: '123456' })

    // The language goes as Accept-Language, the screen's, which the transport adds to every request.
    expect(body).toMatchObject({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    expect(body).not.toHaveProperty('locale')
  })
  // prumo:end-email-code

  // prumo:phone-code
  it("sends the device's timezone with a texted code, for the account it may create, and no language", async () => {
    let body: unknown
    const auth = createAuthClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'POST /api/auth/phone/sign-in': async (request) => {
          body = await request.json()
          return new Response(null, { status: 204 })
        },
      }),
    })

    await auth.signInWithPhoneCode({ phone: '+14155552671', code: '123456' })

    expect(body).toMatchObject({
      phone: '+14155552671',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    expect(body).not.toHaveProperty('locale')
  })
  // prumo:end-phone-code

  // prumo:password
  it("sends the device's timezone with a sign-up, for the new profile, and no language", async () => {
    let body: unknown
    const auth = createAuthClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'POST /api/auth/sign-up': async (request) => {
          body = await request.json()
          return json(201, { verificationRequired: false })
        },
      }),
    })

    await auth.signUp({ name: 'Ana', email: 'ana@example.com', password: 'correct-horse-battery' })

    // The language goes as Accept-Language, the screen's, which the transport adds to every request.
    expect(body).toMatchObject({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
    expect(body).not.toHaveProperty('locale')
  })
  // prumo:end-password

  it('refreshes once on a 401, repeats the request, and asks nothing of the body', async () => {
    const calls: string[] = []
    let valid = false
    const auth = createAuthClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'GET /api/v1/things': () => {
          calls.push('things')
          return valid ? json(200, []) : json(401, {})
        },
        'POST /api/auth/refresh': (request) => {
          calls.push(`refresh:${request.headers.get('x-auth-transport')}`)
          valid = true
          return new Response(null, { status: 204 })
        },
      }),
    })

    const response = await auth.fetch(`${API_URL}/api/v1/things`)

    expect(response.status).toBe(200)
    expect(calls).toEqual(['things', 'refresh:null', 'things'])
  })

  it('makes one refresh for every request refused at once', async () => {
    let refreshes = 0
    let valid = false
    const auth = createAuthClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'GET /api/v1/things': () => (valid ? json(200, []) : json(401, {})),
        'POST /api/auth/refresh': async () => {
          refreshes += 1
          await new Promise((resolve) => setTimeout(resolve, 10))
          valid = true
          return new Response(null, { status: 204 })
        },
      }),
    })

    const responses = await Promise.all([1, 2, 3].map(() => auth.fetch(`${API_URL}/api/v1/things`)))

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200])
    expect(refreshes).toBe(1)
  })

  it('repeats the request when another tab rotated the token first', async () => {
    let valid = false
    const auth = createAuthClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'GET /api/v1/things': () => {
          const response = valid ? json(200, []) : json(401, {})
          valid = true
          return response
        },
        'POST /api/auth/refresh': () => json(409, {}),
      }),
    })

    expect((await auth.fetch(`${API_URL}/api/v1/things`)).status).toBe(200)
  })

  it('answers a visitor without a session with null', async () => {
    const auth = createAuthClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'GET /api/auth/session': () => json(401, {}),
        'POST /api/auth/refresh': () => json(401, {}),
      }),
    })

    expect(await auth.getSession()).toBeNull()
  })
})

describe('createAuthClient for a native app', () => {
  it('keeps the tokens it signs in with, and sends them as a bearer', async () => {
    const tokens = memoryStore()
    let authorization: string | null = null
    const auth = createAuthClient({
      baseUrl: API_URL,
      tokens,
      fetch: fakeTransport({
        'POST /api/auth/sign-in': (request) =>
          request.headers.get('x-auth-transport') === 'bearer' ? json(200, TOKENS) : json(400, {}),
        'POST /api/auth/email/sign-in': (request) =>
          request.headers.get('x-auth-transport') === 'bearer' ? json(200, TOKENS) : json(400, {}),
        'POST /api/auth/phone/sign-in': (request) =>
          request.headers.get('x-auth-transport') === 'bearer' ? json(200, TOKENS) : json(400, {}),
        'GET /api/auth/session': (request) => {
          authorization = request.headers.get('authorization')
          return json(200, { user: { id: 'user-1', email: 'ana@example.com' } })
        },
      }),
    })

    await signIn?.(auth)
    await auth.getSession()

    expect(tokens.current).toEqual(TOKENS)
    expect(authorization).toBe('Bearer access-1')
  })

  it('refreshes with the stored token, and forgets both when that fails', async () => {
    const tokens = memoryStore(TOKENS)
    let sent: unknown
    const auth = createAuthClient({
      baseUrl: API_URL,
      tokens,
      fetch: fakeTransport({
        'GET /api/auth/session': () => json(401, {}),
        'POST /api/auth/refresh': async (request) => {
          sent = await request.json()
          return json(401, {})
        },
      }),
    })

    expect(await auth.getSession()).toBeNull()
    expect(sent).toEqual({ refreshToken: 'refresh-1' })
    expect(tokens.current).toBeNull()
  })

  it('forgets the tokens on sign-out even when the request never arrives', async () => {
    const tokens = memoryStore(TOKENS)
    const auth = createAuthClient({
      baseUrl: API_URL,
      tokens,
      fetch: fakeTransport({
        'POST /api/auth/sign-out': () => {
          throw new TypeError('Network request failed')
        },
      }),
    })

    await expect(auth.signOut()).rejects.toThrow('Network request failed')
    expect(tokens.current).toBeNull()
  })
})
