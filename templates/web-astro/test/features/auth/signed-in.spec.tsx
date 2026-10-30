import { fakeTransport, json } from '@test/support/fake-transport'
import { at } from '@test/support/messages'
import { renderAt } from '@test/support/render'
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SignedIn } from '@/features/auth/signed-in'
import { navigate } from '@/lib/navigate'

const signedOut = {
  'GET /api/auth/session': () => json(401, {}),
  'POST /api/auth/refresh': () => json(401, {}),
}

describe('SignedIn', () => {
  // An MCP client opens the browser at the API, which sends it to /consent; without a session, sign-in comes first.
  it('sends a visitor without a session to sign in, to come back to the same address', async () => {
    renderAt('/consent?request=abc', <SignedIn>secret</SignedIn>, fakeTransport(signedOut))

    await waitFor(() =>
      expect(navigate.replace).toHaveBeenCalledWith(
        `${at('/sign-in')}?${new URLSearchParams({ redirect: '/consent?request=abc' })}`,
      ),
    )
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('shows what it holds once the session is known', async () => {
    renderAt(
      '/account',
      <SignedIn>secret</SignedIn>,
      fakeTransport({
        'GET /api/auth/session': () =>
          json(200, { user: { id: 'user-1', email: 'ana@example.com' } }),
      }),
    )

    expect(await screen.findByText('secret')).toBeInTheDocument()
    expect(navigate.replace).not.toHaveBeenCalled()
  })
})
