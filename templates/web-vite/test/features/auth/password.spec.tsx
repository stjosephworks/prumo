import { fakeTransport, json } from '@test/support/fake-transport'
import { messages } from '@test/support/messages'
import { renderApp } from '@test/support/render-app'
import { withPassword } from '@test/support/with-password'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

describe('SignInForm', () => {
  it('shows a rejected sign-in as a form-level error', async () => {
    const user = userEvent.setup()

    renderApp(
      '/sign-in',
      fakeTransport({
        'POST /api/auth/sign-in': () =>
          json(
            401,
            { title: 'Unauthorized', status: 401, detail: 'Invalid email or password' },
            'application/problem+json',
          ),
      }),
    )

    await withPassword(user)
    await user.type(await screen.findByLabelText(messages.auth.email), 'ana@example.com')
    await user.type(screen.getByLabelText(messages.auth.signIn.password), 'wrong-password')
    await user.click(screen.getByRole('button', { name: messages.auth.signIn.submit }))

    const form = screen.getByRole('button', { name: messages.auth.signIn.submit }).closest('form')

    expect(form).not.toBeNull()
    expect(
      await within(form as HTMLFormElement).findByText('Invalid email or password'),
    ).toBeInTheDocument()
  })
})
