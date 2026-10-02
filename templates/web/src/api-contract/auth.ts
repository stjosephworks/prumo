import { queryOptions } from '@tanstack/react-query'
import { ApiError } from './api-error'
import type { Transport } from './client'

export type Session = { user: { id: string; email: string } }

export type Tokens = { accessToken: string; refreshToken: string; expiresIn: number }

export type SignUpRequest = { name: string; email: string; password: string }

export type SignInRequest = { email: string; password: string }

// Where a native client keeps its tokens. The web passes none: its tokens live in cookies no script can read.
export type TokenStore = {
  read(): Promise<Tokens | null>
  write(tokens: Tokens | null): Promise<void>
}

export type AuthClient = ReturnType<typeof createAuthClient>

export function createAuthClient({
  baseUrl,
  fetch,
  tokens,
}: {
  baseUrl: string
  fetch: Transport
  tokens?: TokenStore
}) {
  const url = (path: string) => `${baseUrl}/api/auth${path}`

  function send(path: string, body?: unknown): Promise<Response> {
    const headers = new Headers()

    // Asking for the tokens in the body is what makes the API leave cookies out.
    if (tokens !== undefined) {
      headers.set('x-auth-transport', 'bearer')
    }

    if (body !== undefined) {
      headers.set('content-type', 'application/json')
    }

    return fetch(url(path), {
      method: 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  async function begin(path: string, body: unknown): Promise<void> {
    const response = await send(path, body)

    if (!response.ok) {
      throw await ApiError.fromResponse(response)
    }

    await tokens?.write((await response.json()) as Tokens)
  }

  let refreshing: Promise<boolean> | undefined

  // Every request that meets a 401 at once waits on the same refresh: a second refresh would present a token the
  // first has already rotated.
  function refresh(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        // The web has no store and sends its cookie; a native client with nothing stored has nothing to send.
        const stored = tokens === undefined ? undefined : await tokens.read()

        if (stored === null) {
          return false
        }

        const response = await send(
          '/refresh',
          stored === undefined ? undefined : { refreshToken: stored.refreshToken },
        )

        // Another tab rotated the token a moment ago, and the browser already holds the new one.
        if (response.status === 409) {
          return true
        }

        if (!response.ok) {
          await tokens?.write(null)
          return false
        }

        await tokens?.write((await response.json()) as Tokens)
        return true
      } finally {
        refreshing = undefined
      }
    })()

    return refreshing
  }

  // Every request to the API goes through here: with a bearer when there is one, and refreshed once on a 401.
  const authorized: Transport = async (input, init) => {
    const attempt = async () => {
      const headers = new Headers(init?.headers)
      const stored = await tokens?.read()

      if (stored !== null && stored !== undefined) {
        headers.set('authorization', `Bearer ${stored.accessToken}`)
      }

      return fetch(input, { ...init, headers })
    }
    const response = await attempt()

    if (response.status !== 401 || !(await refresh())) {
      return response
    }

    return attempt()
  }

  return {
    baseUrl,
    fetch: authorized,
    refresh,

    signUp: (request: SignUpRequest) => begin('/sign-up', request),

    signIn: (request: SignInRequest) => begin('/sign-in', request),

    // The device forgets the tokens whether or not the request arrives: signing out locally is what was asked.
    async signOut(): Promise<void> {
      try {
        const response = await authorized(url('/sign-out'), { method: 'POST' })

        if (!response.ok && response.status !== 401) {
          throw await ApiError.fromResponse(response)
        }
      } finally {
        await tokens?.write(null)
      }
    },

    // A visitor without a session is not an error: the answer is null.
    async getSession(): Promise<Session | null> {
      const response = await authorized(url('/session'))

      if (response.status === 401) {
        return null
      }

      if (!response.ok) {
        throw await ApiError.fromResponse(response)
      }

      return (await response.json()) as Session
    },
  }
}

export const sessionQuery = (auth: Pick<AuthClient, 'getSession'>) =>
  queryOptions({ queryKey: ['session'], queryFn: () => auth.getSession() })
