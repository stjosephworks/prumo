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
  displayName: 'ana',
  locale: 'en',
  timezone: 'UTC',
  createdAt: '2026-09-14T12:57:24.057Z',
  updatedAt: '2026-09-14T12:57:24.057Z',
}

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
      'GET /api/v1/users/me': () => json(200, profile),
      ...routes,
    }),
  }
}

// prumo:phone-code
// With email beside it, the phone waits behind a switch; alone, it is already there.
async function byPhone(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('button', { name: 'Send me a code' })

  const toPhone = screen.queryByRole('button', { name: 'Use a phone number instead' })

  if (toPhone !== null) {
    await user.click(toPhone)
  }
}

// prumo:end-phone-code
describe('signing in with a code on the web', () => {
  // prumo:email-code
  it('sends a code to the address and signs in with it, into the app', async () => {
    const visitor = userEvent.setup()
    const { state, transport } = app({
      'POST /api/auth/email/code': () => empty(204),
      'POST /api/auth/email/sign-in': () => {
        state.signedIn = true
        return empty(204)
      },
    })

    renderApp('/sign-in', transport)

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.click(screen.getByRole('button', { name: 'Send me a code' }))
    expect(await screen.findByText(/We sent a 6-digit code to/)).toBeInTheDocument()
    await visitor.type(screen.getByLabelText('Code'), '123456')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
  })

  it('goes on to the code when one was sent moments ago, counting down to the next', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({
      'POST /api/auth/email/code': () =>
        problem(429, { code: 'too_many_codes' }, { 'retry-after': '42' }),
    })

    renderApp('/sign-in', transport)

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.click(screen.getByRole('button', { name: 'Send me a code' }))

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

    renderApp('/sign-in', transport)

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.click(screen.getByRole('button', { name: 'Send me a code' }))
    await visitor.type(await screen.findByLabelText('Code'), '000000')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/The code is wrong or has expired/)).toBeInTheDocument()
  })
  // prumo:end-email-code

  // prumo:phone-code
  it('texts a code to the number and signs in with it, into the app', async () => {
    const visitor = userEvent.setup()
    const { state, transport } = app({
      'POST /api/auth/phone/code': () => empty(204),
      'POST /api/auth/phone/sign-in': () => {
        state.signedIn = true
        return empty(204)
      },
    })

    renderApp('/sign-in', transport)

    await byPhone(visitor)
    await visitor.type(screen.getByLabelText('Phone number'), '+1 415 555 2671')
    await visitor.click(screen.getByRole('button', { name: 'Send me a code' }))
    await visitor.type(await screen.findByLabelText('Code'), '123456')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
  })

  it('says a number the API cannot text is refused, on the number', async () => {
    const visitor = userEvent.setup()
    const { transport } = app({
      'POST /api/auth/phone/code': () =>
        problem(422, {
          code: 'phone_not_served',
          detail: 'Texts are not sent to numbers in that country',
        }),
    })

    renderApp('/sign-in', transport)

    await byPhone(visitor)
    await visitor.type(screen.getByLabelText('Phone number'), '+44 7911 123456')
    await visitor.click(screen.getByRole('button', { name: 'Send me a code' }))

    expect(await screen.findByText(/not sent to numbers in that country/)).toBeInTheDocument()
  })
  // prumo:end-phone-code
})
