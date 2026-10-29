import { queryOptions } from '@tanstack/react-query'
import { ApiError } from './api-error'
import type { Transport } from './client'

export type Session = {
  user: {
    id: string
    // biome-ignore format: one member a line, so cutting a feature cuts its own
    email:
      | string
      | null // prumo:phone-code
    phone: string | null // prumo:phone-code
  }
}

export type Tokens = { accessToken: string; refreshToken: string; expiresIn: number }

// prumo:password
export type SignUpRequest = { name: string; email: string; password: string }

export type SignInRequest = { email: string; password: string }

// prumo:end-password
// prumo:email-code
export type CodeSignInRequest = { email: string; code: string }

// prumo:end-email-code
// prumo:phone-code
export type PhoneSignInRequest = { phone: string; code: string }

// prumo:end-phone-code

// prumo:email
export type VerifyEmailRequest = { email: string; code: string }

export type ResetPasswordRequest = { email: string; code: string; password: string }

// prumo:end-email
// prumo:social
export type SocialProvider = 'google' | 'apple'

// prumo:end-social
// An account that must confirm its email first gets no session from signing up, and says so.
export type SignUpResult = { verificationRequired: boolean }

// Where a native client keeps its tokens. The web passes none: its tokens live in cookies no script can read.
export type TokenStore = {
  read(): Promise<Tokens | null>
  write(tokens: Tokens | null): Promise<void>
}

export type AuthClient = ReturnType<typeof createAuthClient>

// The device's timezone, sent when an account is created so its profile starts in it. Its language needs no field:
// every request carries the one the screen speaks as Accept-Language, which the new profile starts in.
function devicePreferences(): { timezone: string } {
  return { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
}

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

  async function begin(path: string, body: unknown): Promise<SignUpResult> {
    const response = await send(path, body)

    if (!response.ok) {
      throw await ApiError.fromResponse(response)
    }

    // The web's answer is empty: its session arrived as cookies.
    const text = await response.text()
    const answer = text === '' ? {} : (JSON.parse(text) as Partial<Tokens & SignUpResult>)

    if (answer.verificationRequired === true) {
      return { verificationRequired: true }
    }

    await tokens?.write(answer as Tokens)
    return { verificationRequired: false }
  }

  // prumo:codes
  async function ask(path: string, body: unknown): Promise<void> {
    const response = await send(path, body)

    if (!response.ok) {
      throw await ApiError.fromResponse(response)
    }
  }

  // prumo:end-codes

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

    // prumo:password
    signUp: (request: SignUpRequest) => begin('/sign-up', { ...request, ...devicePreferences() }),

    signIn: async (request: SignInRequest): Promise<void> => {
      await begin('/sign-in', request)
    },
    // prumo:end-password
    // prumo:email-code
    // Sent to any address, with an account or not: the first code an address enters creates its account.
    requestSignInCode: (email: string) => ask('/email/code', { email }),

    signInWithCode: async (request: CodeSignInRequest): Promise<void> => {
      await begin('/email/sign-in', { ...request, ...devicePreferences() })
    },
    // prumo:end-email-code
    // prumo:phone-code
    // Texted to any mobile number the API serves, as typed with its country code; the API reads it as E.164.
    requestPhoneCode: (phone: string) => ask('/phone/code', { phone }),

    signInWithPhoneCode: async (request: PhoneSignInRequest): Promise<void> => {
      await begin('/phone/sign-in', { ...request, ...devicePreferences() })
    },
    // prumo:end-phone-code

    // prumo:email
    // Each answers alike for an unknown email, so a form can say "if the account exists, a code is on its way".
    requestEmailVerification: (email: string) => ask('/email/verification', { email }),

    verifyEmail: async (request: VerifyEmailRequest): Promise<void> => {
      await begin('/email/verify', request)
    },

    requestPasswordReset: (email: string) => ask('/password/forgot', { email }),

    resetPassword: async (request: ResetPasswordRequest): Promise<void> => {
      await begin('/password/reset', request)
    },
    // prumo:end-email
    // prumo:social
    // Where to send the browser to sign in with a provider: the API takes it there and back. The web comes back
    // signed in, to the origin it names when the API trusts several; a mobile app comes back with a code to exchange.
    socialSignInUrl: (
      provider: SocialProvider,
      client: 'web' | 'mobile',
      returnTo = '/',
      origin?: string,
    ) => {
      const query = new URLSearchParams({ client, returnTo })

      if (origin !== undefined) {
        query.set('origin', origin)
      }

      return `${url(`/social/${provider}`)}?${query}`
    },

    exchangeSocialCode: async (code: string): Promise<void> => {
      await begin('/social/exchange', { code })
    },

    // What a provider's own sign-in sheet on the phone gave the app, traded for the app's tokens. `trip` is the one
    // whose nonce went to the sheet, where the provider takes one.
    signInWithIdToken: async (
      provider: SocialProvider,
      credential: { idToken: string; trip?: string; name?: string },
    ): Promise<void> => {
      await begin(`/social/${provider}/token`, credential)
    },
    // prumo:end-social

    // prumo:apple
    // Where to send the browser to delete an account that signs in with Apple: the API takes it to Apple, which
    // revokes the account's authorization, and back to sign-in with `deleted=1`.
    accountDeletionUrl: async (client: 'web' | 'mobile', origin?: string): Promise<string> => {
      const response = await authorized(url('/social/apple/deletion'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client, ...(origin !== undefined && { origin }) }),
      })

      if (!response.ok) {
        throw await ApiError.fromResponse(response)
      }

      return ((await response.json()) as { url: string }).url
    },

    // A nonce for Apple's own sheet, which writes it into its token, and the trip to send back with that token. For a
    // deletion, the trip is bound to the signed-in account.
    appleNonce: async (
      purpose: 'sign-in' | 'deletion' = 'sign-in',
    ): Promise<{ trip: string; nonce: string }> => {
      const response =
        purpose === 'sign-in'
          ? await send('/social/apple/nonce')
          : await authorized(url('/social/apple/deletion/nonce'), { method: 'POST' })

      if (!response.ok) {
        throw await ApiError.fromResponse(response)
      }

      return (await response.json()) as { trip: string; nonce: string }
    },

    // Deletes the account from the app, once Apple's own sheet confirmed it on a trip from `appleNonce('deletion')`.
    async deleteAccountWithApple(credential: {
      trip: string
      idToken: string
      code: string
    }): Promise<void> {
      const response = await authorized(url('/social/apple/deletion/token'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(credential),
      })

      if (!response.ok) {
        throw await ApiError.fromResponse(response)
      }

      await tokens?.write(null)
    },
    // prumo:end-apple

    // Deletes the signed-in person's account. The API asks for a sign-in of moments ago, and refuses an older one
    // with 403 `reauthentication_required`.
    async deleteAccount(): Promise<void> {
      const response = await authorized(url('/account'), { method: 'DELETE' })

      if (!response.ok) {
        throw await ApiError.fromResponse(response)
      }

      await tokens?.write(null)
    },

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
