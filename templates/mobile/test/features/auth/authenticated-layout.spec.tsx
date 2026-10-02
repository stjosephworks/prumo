import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { renderRouter, screen } from 'expo-router/testing-library'
import type { ReactNode } from 'react'
import { Text } from 'react-native'
import { createAuthClient, createClient } from '@/api-contract'
import AuthenticatedLayout from '@/app/(app)/_layout'
import { ClientsProvider } from '@/features/clients/clients-context'

const user = { id: 'user-1', email: 'ana@example.com' }

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }

async function renderAt(getSession: () => Response | Promise<Response>) {
  const transport = fakeTransport({
    'GET /api/auth/session': getSession,
    'POST /api/auth/refresh': () => json(401, {}),
  })
  const auth = createAuthClient({
    baseUrl: API_URL,
    fetch: transport,
    tokens: memoryTokenStore(TOKENS),
  })
  const clients = { auth, api: createClient({ baseUrl: API_URL, fetch: auth.fetch }) }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ClientsProvider clients={clients}>{children}</ClientsProvider>
      </QueryClientProvider>
    )
  }

  await renderRouter(
    {
      '(app)/_layout': AuthenticatedLayout,
      '(app)/index': () => <Text>Your profile</Text>,
      'sign-in': () => <Text>Sign in</Text>,
    },
    { initialUrl: '/', wrapper: Providers },
  )
}

describe('AuthenticatedLayout', () => {
  // An empty cache is what signing out leaves behind, and the session then takes a request to arrive.
  it('waits for a session still on its way instead of sending a signed-in visitor to sign in', async () => {
    await renderAt(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return json(200, { user })
    })

    expect(await screen.findByText('Your profile')).toBeOnTheScreen()
    expect(screen.queryByText('Sign in')).toBeNull()
  })

  it('sends a visitor without a session to sign in', async () => {
    await renderAt(() => json(401, {}))

    expect(await screen.findByText('Sign in')).toBeOnTheScreen()
  })

  // Waiting on a pending session must not become a way in: a session that cannot be read is not a session.
  it('sends a visitor to sign in when the session cannot be read', async () => {
    await renderAt(() => json(500, { message: 'Internal server error' }))

    expect(await screen.findByText('Sign in')).toBeOnTheScreen()
    expect(screen.queryByText('Your profile')).toBeNull()
  })
})
