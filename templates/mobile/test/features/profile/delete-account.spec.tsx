import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { createTestQueryClient } from '@test/support/query-client'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import * as WebBrowser from 'expo-web-browser' // prumo:apple
import { createAuthClient } from '@/api-contract'
import { DeleteAccount } from '@/features/profile/delete-account'
import { clearUserData } from '@/features/storage/storage'

// MMKV is native; what deleting clears from it, a test only needs to see asked for.
jest.mock('@/features/storage/storage', () => ({ clearUserData: jest.fn() }))
// prumo:apple
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }))
// jest-expo leaves the app manifest empty, so expo-linking cannot know the app's scheme; this one stands in for it.
jest.mock('expo-linking', () => ({
  ...jest.requireActual('expo-linking'),
  createURL: (path: string) => `acme://${path}`,
}))
// prumo:end-apple

async function renderDelete(
  answer: () => Response,
  routes: Parameters<typeof fakeTransport>[0] = {},
) {
  const tokens = memoryTokenStore()

  await tokens.write({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 })

  const auth = createAuthClient({
    baseUrl: API_URL,
    tokens,
    fetch: fakeTransport({
      ...routes,
      'DELETE /api/auth/account': answer,
      'POST /api/auth/sign-out': () => new Response(null, { status: 204 }),
    }),
  })
  const onSignedOut = jest.fn()

  await render(
    <QueryClientProvider client={createTestQueryClient()}>
      <DeleteAccount auth={auth} onSignedOut={onSignedOut} />
    </QueryClientProvider>,
  )

  return { onSignedOut, tokens }
}

describe('DeleteAccount', () => {
  beforeEach(() => jest.mocked(clearUserData).mockClear())

  it('asks twice, deletes, and forgets everything on the device', async () => {
    const user = userEvent.setup()
    const { onSignedOut, tokens } = await renderDelete(() => new Response(null, { status: 204 }))

    await user.press(screen.getByRole('button', { name: 'Delete account' }))
    await user.press(screen.getByRole('button', { name: 'Delete my account' }))

    expect(onSignedOut).toHaveBeenCalled()
    expect(clearUserData).toHaveBeenCalled()
    await expect(tokens.read()).resolves.toBeNull()
  })

  it('asks for a fresh sign-in when the last one is too old', async () => {
    const user = userEvent.setup()

    await renderDelete(() =>
      json(
        403,
        { status: 403, title: 'Forbidden', code: 'reauthentication_required' },
        'application/problem+json',
      ),
    )

    await user.press(screen.getByRole('button', { name: 'Delete account' }))
    await user.press(screen.getByRole('button', { name: 'Delete my account' }))

    expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeOnTheScreen()
  })

  // prumo:apple
  it('sends an account that signs in with Apple to confirm with Apple, then forgets it', async () => {
    const user = userEvent.setup()
    const asked: string[] = []
    const apple = `${API_URL}/api/auth/social/apple/deletion?ticket=t`

    jest
      .mocked(WebBrowser.openAuthSessionAsync)
      .mockResolvedValue({ type: 'success', url: 'acme://social?deleted=1' })
    const { onSignedOut, tokens } = await renderDelete(
      () =>
        json(
          409,
          { status: 409, title: 'Conflict', code: 'provider_confirmation_required' },
          'application/problem+json',
        ),
      {
        'POST /api/auth/social/apple/deletion': async (request) => {
          asked.push(((await request.json()) as { client: string }).client)
          return json(200, { url: apple })
        },
        // The account is gone, and the session with it.
        'POST /api/auth/sign-out': () => json(401, {}),
      },
    )

    await user.press(screen.getByRole('button', { name: 'Delete account' }))
    await user.press(screen.getByRole('button', { name: 'Delete my account' }))
    await user.press(await screen.findByRole('button', { name: 'Continue with Apple' }))

    await waitFor(() => expect(onSignedOut).toHaveBeenCalled())
    expect(asked).toEqual(['mobile'])
    expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith(apple, 'acme://social')
    expect(clearUserData).toHaveBeenCalled()
    await expect(tokens.read()).resolves.toBeNull()
  })
  // prumo:end-apple
})
