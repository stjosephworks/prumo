import { fakeTransport, json } from '@test/support/fake-transport'
import { at, messages } from '@test/support/messages'
import { renderIsland } from '@test/support/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ForgotPassword } from '@/features/auth/forgot-password-form'
import { ResetPassword } from '@/features/auth/reset-password-form'
import { SignIn } from '@/features/auth/sign-in-form'
import { SignUp } from '@/features/auth/sign-up-form'
import { VerifyEmail } from '@/features/auth/verify-email-form'
import { format } from '@/i18n/locales'
import { navigate } from '@/lib/navigate'

const user = { id: 'user-1', email: 'ana@example.com' }

const empty = (status: number) => new Response(null, { status })

const problem = (status: number, body: Record<string, unknown>) =>
  json(status, { status, title: 'Error', ...body }, 'application/problem+json')

// A visitor whose session appears once `signedIn` flips, as cookies would.
function api(routes: Parameters<typeof fakeTransport>[0]) {
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

const withEmail = (path: string) => `${path}?${new URLSearchParams({ email: user.email })}`

describe('email verification on the web', () => {
  it('takes a new account to the code', async () => {
    const visitor = userEvent.setup()
    const { transport } = api({
      'POST /api/auth/sign-up': () => json(201, { verificationRequired: true }),
    })

    renderIsland('/sign-up', SignUp, transport)

    await visitor.type(await screen.findByLabelText(messages.auth.signUp.name), 'Ana')
    await visitor.type(screen.getByLabelText(messages.auth.email), user.email)
    await visitor.type(
      screen.getByLabelText(messages.auth.signIn.password),
      'correct-horse-battery',
    )
    await visitor.click(screen.getByRole('button', { name: messages.auth.signUp.submit }))

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith(withEmail(at('/verify-email'))))
  })

  it('takes the account into the app once the code is entered', async () => {
    const visitor = userEvent.setup()
    const { state, transport } = api({
      'POST /api/auth/email/verify': () => {
        state.signedIn = true
        return empty(204)
      },
    })

    renderIsland(withEmail('/verify-email'), VerifyEmail, transport)

    await visitor.type(await screen.findByLabelText(messages.forms.code), '123456')
    await visitor.click(screen.getByRole('button', { name: messages.auth.verifyEmail.submit }))

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith(at('/account')))
  })

  it('sends an unconfirmed account that signs in to the code page', async () => {
    const visitor = userEvent.setup()
    const { transport } = api({
      'POST /api/auth/sign-in': () => problem(403, { code: 'email_not_verified' }),
    })

    renderIsland('/sign-in', SignIn, transport)

    await visitor.type(await screen.findByLabelText(messages.auth.email), user.email)
    await visitor.type(
      screen.getByLabelText(messages.auth.signIn.password),
      'correct-horse-battery',
    )
    await visitor.click(screen.getByRole('button', { name: messages.auth.signIn.submit }))

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith(withEmail(at('/verify-email'))))
  })

  it('counts down to the next code when one was sent moments ago', async () => {
    const visitor = userEvent.setup()
    const { transport } = api({
      'POST /api/auth/email/verification': () =>
        new Response(
          JSON.stringify({ status: 429, title: 'Too Many Requests', code: 'too_many_codes' }),
          {
            status: 429,
            headers: { 'content-type': 'application/problem+json', 'retry-after': '42' },
          },
        ),
    })

    renderIsland(withEmail('/verify-email'), VerifyEmail, transport)

    await visitor.click(await screen.findByRole('button', { name: messages.forms.sendNewCode }))

    expect(
      await screen.findByRole('button', {
        name: format(messages.forms.sendNewCodeIn, { seconds: 42 }),
      }),
    ).toBeDisabled()
  })

  it('shows a wrong code on the code field', async () => {
    const visitor = userEvent.setup()
    const { transport } = api({
      'POST /api/auth/email/verify': () =>
        problem(422, { code: 'invalid_code', detail: 'The code is wrong or has expired' }),
    })

    renderIsland(withEmail('/verify-email'), VerifyEmail, transport)

    await visitor.type(await screen.findByLabelText(messages.forms.code), '000000')
    await visitor.click(screen.getByRole('button', { name: messages.auth.verifyEmail.submit }))

    expect(await screen.findByText(/The code is wrong or has expired/)).toBeInTheDocument()
  })
})

describe('password reset on the web', () => {
  it('goes from forgot to reset', async () => {
    const visitor = userEvent.setup()
    const { transport } = api({ 'POST /api/auth/password/forgot': () => empty(204) })

    renderIsland('/forgot-password', ForgotPassword, transport)

    await visitor.type(await screen.findByLabelText(messages.auth.email), user.email)
    await visitor.click(screen.getByRole('button', { name: messages.auth.forgotPassword.submit }))

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith(withEmail(at('/reset-password'))))
  })

  it('goes from reset into the app', async () => {
    const visitor = userEvent.setup()
    const { state, transport } = api({
      'POST /api/auth/password/reset': () => {
        state.signedIn = true
        return empty(204)
      },
    })

    renderIsland(withEmail('/reset-password'), ResetPassword, transport)

    await visitor.type(await screen.findByLabelText(messages.forms.code), '123456')
    await visitor.type(
      screen.getByLabelText(messages.auth.resetPassword.password),
      'another-good-password',
    )
    await visitor.click(screen.getByRole('button', { name: messages.auth.resetPassword.submit }))

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith(at('/account')))
  })
})
