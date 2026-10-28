import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { createTestQueryClient } from '@test/support/query-client'
import { render, screen, userEvent } from '@testing-library/react-native'
import { createAuthClient } from '@/api-contract'
import { DeleteAccount } from '@/features/profile/delete-account'
import { clearUserData } from '@/features/storage/storage'

// MMKV is native; what deleting clears from it, a test only needs to see asked for.
jest.mock('@/features/storage/storage', () => ({ clearUserData: jest.fn() }))

async function renderDelete(answer: () => Response) {
  const tokens = memoryTokenStore()

  await tokens.write({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 })

  const auth = createAuthClient({
    baseUrl: API_URL,
    tokens,
    fetch: fakeTransport({
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
})
