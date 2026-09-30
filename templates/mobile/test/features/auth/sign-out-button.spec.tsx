import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { createAuthClient } from 'better-auth/react'
import { SignOutButton } from '@/features/auth/sign-out-button'
import { clearUserData } from '@/features/storage/storage'

// MMKV needs its native module, which Jest does not have. What clearUserData removes is the persister's own key.
jest.mock('@/features/storage/storage', () => ({ clearUserData: jest.fn() }))

async function signOutWith(signOut: () => Response | Promise<Response>) {
  const queryClient = new QueryClient()
  const onSignedOut = jest.fn()
  // jest-expo leaves the app manifest empty, and the Expo plugin needs it to build an origin; the button depends only on
  // signOut resolving or failing, which the plugin does not change.
  const auth = createAuthClient({
    baseURL: API_URL,
    basePath: '/api/auth',
    fetchOptions: { customFetchImpl: fakeTransport({ 'POST /api/auth/sign-out': signOut }) },
  })

  queryClient.setQueryData(['session'], { session: { id: 'session-1' }, user: { id: 'user-1' } })
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
    const queryClient = await signOutWith(() => json(200, { success: true }))

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
