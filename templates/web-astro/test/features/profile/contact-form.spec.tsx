import { fakeTransport, json } from '@test/support/fake-transport'
import { renderIsland } from '@test/support/render'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@/api-contract'
import { Account } from '@/features/profile/account'

const profile: Profile = {
  id: 'profile-1',
  userId: 'user-1',
  displayName: 'Ana',
  locale: 'en',
  timezone: 'UTC',
  createdAt: '2026-09-14T12:57:24.057Z',
  updatedAt: '2026-09-14T12:57:24.057Z',
}

const empty = (status: number) => new Response(null, { status })

// A signed-in person whose addresses change as the fake API is told.
function app(routes: Parameters<typeof fakeTransport>[0] = {}) {
  const user: { id: string; email: string | null; phone: string | null } = {
    id: 'user-1',
    email: 'ana@example.com',
    phone: null,
  }

  return {
    user,
    transport: fakeTransport({
      'GET /api/auth/session': () => json(200, { user }),
      'GET /api/v1/users/me': () => json(200, profile),
      ...routes,
    }),
  }
}

describe('the contact form', () => {
  // prumo:mail
  it('changes the email with a code sent to the new address', async () => {
    const visitor = userEvent.setup()
    const state = app()
    const { transport } = app({
      'GET /api/auth/session': () => json(200, { user: state.user }),
      'POST /api/v1/users/me/email/code': () => empty(204),
      'POST /api/v1/users/me/email': () => {
        state.user.email = 'new@example.com'
        return json(200, { user: state.user })
      },
    })

    renderIsland('/account', Account, transport)

    await visitor.click(await screen.findByRole('button', { name: 'Change your email' }))
    await visitor.type(screen.getByLabelText('New email'), 'new@example.com')
    await visitor.click(screen.getByRole('button', { name: 'Send a code there' }))
    await visitor.type(await screen.findByLabelText('Code'), '123456')
    await visitor.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('new@example.com')).toBeInTheDocument()
  })

  it('asks for a fresh sign-in when the last one is too old', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({
      'POST /api/v1/users/me/email/code': () =>
        json(
          403,
          { status: 403, title: 'Forbidden', code: 'reauthentication_required' },
          'application/problem+json',
        ),
    })

    renderIsland('/account', Account, transport)

    await visitor.click(await screen.findByRole('button', { name: 'Change your email' }))
    await visitor.type(screen.getByLabelText('New email'), 'new@example.com')
    await visitor.click(screen.getByRole('button', { name: 'Send a code there' }))

    expect(await screen.findByRole('button', { name: 'Sign in again' })).toBeInTheDocument()
  })
  // prumo:end-mail

  // prumo:sms
  it('adds a phone with a code texted to it', async () => {
    const visitor = userEvent.setup()
    const state = app()
    const { transport } = app({
      'GET /api/auth/session': () => json(200, { user: state.user }),
      'POST /api/v1/users/me/phone/code': () => empty(204),
      'POST /api/v1/users/me/phone': () => {
        state.user.phone = '+14155552671'
        return json(200, { user: state.user })
      },
    })

    renderIsland('/account', Account, transport)

    await visitor.click(await screen.findByRole('button', { name: 'Add a phone number' }))
    await visitor.type(screen.getByLabelText('New phone number'), '+1 415 555 2671')
    await visitor.click(screen.getByRole('button', { name: 'Send a code there' }))
    await visitor.type(await screen.findByLabelText('Code'), '123456')
    await visitor.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('+14155552671')).toBeInTheDocument()
  })
  // prumo:end-sms
})
