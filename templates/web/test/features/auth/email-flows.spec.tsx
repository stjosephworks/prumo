import { fakeTransport, json } from '@test/support/fake-transport'
import { renderApp } from '@test/support/render-app'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@/api-contract'

const user = { id: 'user-1', email: 'ana@example.com' }

const profile: Profile = {
  id: 'profile-1',
  userId: user.id,
  displayName: 'Ana',
  locale: 'en',
  timezone: 'UTC',
  createdAt: '2026-09-14T12:57:24.057Z',
  updatedAt: '2026-09-14T12:57:24.057Z',
}

const empty = (status: number) => new Response(null, { status })

const problem = (status: number, body: Record<string, unknown>) =>
  json(status, { status, title: 'Error', ...body }, 'application/problem+json')

// A visitor whose session appears once `signedIn` flips, as cookies would.
function app(routes: Parameters<typeof fakeTransport>[0]) {
  const state = { signedIn: false }

  return {
    state,
    transport: fakeTransport({
      'GET /api/auth/session': () => (state.signedIn ? json(200, { user }) : json(401, {})),
      'POST /api/auth/refresh': () => json(401, {}),
      'GET /api/v1/users/me': () => json(200, profile),
      ...routes,
    }),
  }
}

describe('email verification on the web', () => {
  it('takes a new account to the code, and into the app once it is entered', async () => {
    const visitor = userEvent.setup()
    const { state, transport } = app({
      'POST /api/auth/sign-up': () => json(201, { verificationRequired: true }),
      'POST /api/auth/email/verify': () => {
        state.signedIn = true
        return empty(204)
      },
    })

    renderApp('/sign-up', transport)

    await visitor.type(await screen.findByLabelText('Name'), 'Ana')
    await visitor.type(screen.getByLabelText('Email'), user.email)
    await visitor.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await visitor.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Confirm your email' })).toBeInTheDocument()

    await visitor.type(screen.getByLabelText('Code'), '123456')
    await visitor.click(screen.getByRole('button', { name: 'Confirm email' }))

    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
  })

  it('sends an unconfirmed account that signs in to the code page', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({
      'POST /api/auth/sign-in': () => problem(403, { code: 'email_not_verified' }),
    })

    renderApp('/sign-in', transport)

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Confirm your email' })).toBeInTheDocument()
  })

  it('shows a wrong code on the code field', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({
      'POST /api/auth/email/verify': () =>
        problem(422, { code: 'invalid_code', detail: 'The code is wrong or has expired' }),
    })

    renderApp(`/verify-email?email=${user.email}`, transport)

    await visitor.type(await screen.findByLabelText('Code'), '000000')
    await visitor.click(screen.getByRole('button', { name: 'Confirm email' }))

    expect(await screen.findByText(/The code is wrong or has expired/)).toBeInTheDocument()
  })
})

describe('password reset on the web', () => {
  it('goes from forgot to reset to the app', async () => {
    const visitor = userEvent.setup()
    const { state, transport } = app({
      'POST /api/auth/password/forgot': () => empty(204),
      'POST /api/auth/password/reset': () => {
        state.signedIn = true
        return empty(204)
      },
    })

    renderApp('/sign-in', transport)

    await visitor.click(await screen.findByRole('link', { name: 'Forgot your password?' }))
    await screen.findByRole('heading', { name: 'Reset your password' })
    await visitor.type(screen.getByLabelText('Email'), user.email)
    await visitor.click(screen.getByRole('button', { name: 'Send a reset code' }))
    await screen.findByRole('heading', { name: 'Choose a new password' })
    await visitor.type(screen.getByLabelText('Code'), '123456')
    await visitor.type(screen.getByLabelText('New password'), 'another-good-password')
    await visitor.click(screen.getByRole('button', { name: 'Set the new password' }))

    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
  })
})
