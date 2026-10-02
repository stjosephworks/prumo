import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { createAuthClient } from '@/api-contract'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { clearUserData } from '@/features/storage/storage'

// MMKV needs its native module, which Jest does not have. What clearUserData removes is the persister's own key.
jest.mock('@/features/storage/storage', () => ({ clearUserData: jest.fn() }))

async function signOutWith(signOut: () => Response | Promise<Response>) {
  const queryClient = new QueryClient()
  const onSignedOut = jest.fn()
  const auth = createAuthClient({
    baseUrl: API_URL,
    tokens: memoryTokenStore({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }),
    fetch: fakeTransport({ 'POST /api/auth/sign-out': signOut }),
  })

  queryClient.setQueryData(['session'], { user: { id: 'user-1', email: 'ana@example.com' } })
  queryClient.setQueryData(['profile', 'me'], { id: 'profile-1', displayName: 'Ana' })

  await render(
    <QueryClientProvider client={queryClient}>
      <SignOutButton auth={auth} onSignedOut={onSignedOut} />
    </QueryClientProvider>,
  )

  await userEvent.setup().press(screen.getByRole('button', { name: 'Sign out' }))
  await waitFor(() => expect(onSignedOut).toHaveBeenCalled())

  return queryClient
}

describe('SignOutButton', () => {
  beforeEach(() => jest.mocked(clearUserData).mockClear())

  it('leaves nothing of the user behind for the next person on the device', async () => {
    const queryClient = await signOutWith(() => new Response(null, { status: 204 }))

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(clearUserData).toHaveBeenCalledTimes(1)
  })

  it('still clears the device when the sign-out request never arrives', async () => {
    const queryClient = await signOutWith(() => {
      throw new TypeError('Network request failed')
    })

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(clearUserData).toHaveBeenCalledTimes(1)
  })
})
