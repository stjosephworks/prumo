import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { describe, expect, it } from 'vitest'
import { createAuthClient, type TokenStore, type Tokens } from '@/api-contract'

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

describe('createAuthClient on the web', () => {
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
        'GET /api/auth/session': (request) => {
          authorization = request.headers.get('authorization')
          return json(200, { user: { id: 'user-1', email: 'ana@example.com' } })
        },
      }),
    })

    await auth.signIn({ email: 'ana@example.com', password: 'correct-horse-battery' })
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
