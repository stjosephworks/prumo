import { fakeTransport, json } from '@test/support/fake-transport'
import { renderApp } from '@test/support/render-app'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

describe('SignInForm', () => {
  it('shows a rejected sign-in as a form-level error', async () => {
    const user = userEvent.setup()

    renderApp(
      '/sign-in',
      fakeTransport({
        'POST /api/auth/sign-in/email': () =>
          json(401, { message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' }),
      }),
    )

    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')

    expect(form).not.toBeNull()
    expect(
      await within(form as HTMLFormElement).findByText('Invalid email or password'),
    ).toBeInTheDocument()
  })
})
