import { fakeTransport, json } from '@test/support/fake-transport'
import { router } from '@test/support/navigation'
import { renderAt } from '@test/support/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@/api-contract'
import { Account } from '@/features/profile/account'
import { BASE_LOCALE } from '@/i18n/locales'

const user = { id: 'user-1', email: 'ana@example.com' }

const profile: Profile = {
  id: 'profile-1',
  userId: user.id,
  displayName: 'Ana',
  locale: BASE_LOCALE,
  timezone: 'UTC',
  createdAt: '2026-09-14T12:57:24.057Z',
  updatedAt: '2026-09-14T12:57:24.057Z',
}

// A signed-in person whose account exists until the API is told to delete it.
function app(deleteAnswer: () => Response, routes: Parameters<typeof fakeTransport>[0] = {}) {
  const state = { exists: true }

  return fakeTransport({
    ...routes,
    'GET /api/auth/session': () => (state.exists ? json(200, { user }) : json(401, {})),
    'POST /api/auth/refresh': () => json(401, {}),
    'GET /api/v1/users/me': () => json(200, profile),
    'POST /api/auth/sign-out': () => new Response(null, { status: 204 }),
    'DELETE /api/auth/account': () => {
      const answer = deleteAnswer()

      state.exists = answer.status !== 204
      return answer
    },
  })
}

describe('deleting the account', () => {
  it('asks twice, deletes, and leaves the person signed out', async () => {
    const visitor = userEvent.setup()

    renderAt(
      '/account',
      <Account />,
      app(() => new Response(null, { status: 204 })),
    )

    await visitor.click(await screen.findByRole('button', { name: 'Delete account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('It cannot be undone')
    await visitor.click(screen.getByRole('button', { name: 'Delete my account' }))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sign-in'))
  })

  it('asks for a fresh sign-in when the last one is too old', async () => {
    const visitor = userEvent.setup()

    renderAt(
      '/account',
      <Account />,
      app(() =>
        json(
          403,
          { status: 403, title: 'Forbidden', code: 'reauthentication_required' },
          'application/problem+json',
        ),
      ),
    )

    await visitor.click(await screen.findByRole('button', { name: 'Delete account' }))
    await visitor.click(screen.getByRole('button', { name: 'Delete my account' }))

    expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeInTheDocument()
  })

  // prumo:apple
  it('sends an account that signs in with Apple to confirm with Apple', async () => {
    const visitor = userEvent.setup()
    const asked: string[] = []

    renderAt(
      '/account',
      <Account />,
      app(
        () =>
          json(
            409,
            { status: 409, title: 'Conflict', code: 'provider_confirmation_required' },
            'application/problem+json',
          ),
        {
          'POST /api/auth/social/apple/deletion': async (request) => {
            asked.push(((await request.json()) as { client: string }).client)
            return json(200, { url: 'http://api.test/api/auth/social/apple/deletion?ticket=t' })
          },
        },
      ),
    )

    await visitor.click(await screen.findByRole('button', { name: 'Delete account' }))
    await visitor.click(screen.getByRole('button', { name: 'Delete my account' }))
    await visitor.click(await screen.findByRole('button', { name: 'Continue with Apple' }))

    await waitFor(() => expect(asked).toEqual(['web']))
  })
  // prumo:end-apple
})
