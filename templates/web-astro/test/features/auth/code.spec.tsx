import { fakeTransport, json } from '@test/support/fake-transport'
import { renderIsland } from '@test/support/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CodeSignIn } from '@/features/auth/code-sign-in-form'
import { SignInWays } from '@/features/auth/sign-in-choice'
import { navigate } from '@/lib/navigate'

const user = { id: 'user-1', email: 'ana@example.com' }

const empty = (status: number) => new Response(null, { status })

const problem = (status: number, body: Record<string, unknown>, headers = {}) =>
  new Response(JSON.stringify({ status, title: 'Error', ...body }), {
    status,
    headers: { 'content-type': 'application/problem+json', ...headers },
  })

// A visitor whose session appears once `signedIn` flips, as cookies would.
function app(routes: Parameters<typeof fakeTransport>[0]) {
  const state = { signedIn: false }

  return {
    state,
    transport: fakeTransport({
      'GET /api/auth/session': () => (state.signedIn ? json(200, { user }) : json(401, {})),
      'POST /api/auth/refresh': () => json(401, {}),
      ...routes,
    }),
  }
}

describe('signing in with an email code on the web', () => {
  it('sends a code to the address and signs in with it, into the app', async () => {
    const visitor = userEvent.setup()
    const { state, transport } = app({
      'POST /api/auth/email/code': () => empty(204),
      'POST /api/auth/email/sign-in': () => {
        state.signedIn = true
        return empty(204)
      },
    })

    renderIsland('/sign-in', CodeSignIn, transport)

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.click(screen.getByRole('button', { name: 'Email me a code' }))
    expect(await screen.findByText(/We sent a 6-digit code to/)).toBeInTheDocument()
    await visitor.type(screen.getByLabelText('Code'), '123456')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith('/account'))
  })

  it('goes on to the code when one was sent moments ago, counting down to the next', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({
      'POST /api/auth/email/code': () =>
        problem(429, { code: 'too_many_codes' }, { 'retry-after': '42' }),
    })

    renderIsland('/sign-in', CodeSignIn, transport)

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.click(screen.getByRole('button', { name: 'Email me a code' }))

    expect(await screen.findByLabelText('Code')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send a new code in 42s' })).toBeDisabled()
  })

  it('shows a wrong code on the code field', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({
      'POST /api/auth/email/code': () => empty(204),
      'POST /api/auth/email/sign-in': () =>
        problem(422, { code: 'invalid_code', detail: 'The code is wrong or has expired' }),
    })

    renderIsland('/sign-in', CodeSignIn, transport)

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.click(screen.getByRole('button', { name: 'Email me a code' }))
    await visitor.type(await screen.findByLabelText('Code'), '000000')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/The code is wrong or has expired/)).toBeInTheDocument()
  })

  // prumo:password
  it('leads with the code, and keeps the password behind a link', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({})

    renderIsland('/sign-in', SignInWays, transport)

    expect(await screen.findByRole('button', { name: 'Email me a code' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).toBeNull()

    await visitor.click(screen.getByRole('button', { name: 'Sign in with a password' }))

    expect(await screen.findByLabelText('Password')).toBeInTheDocument()
  })
  // prumo:end-password
})
