import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { render, screen, userEvent } from '@testing-library/react-native'
import { createAuthClient } from 'better-auth/react'
import { SignInForm } from '@/features/auth/sign-in-form'

describe('SignInForm', () => {
  it('shows a rejected sign-in as a form-level error', async () => {
    const onSignedIn = jest.fn()
    // jest-expo leaves the app manifest empty, and the Expo plugin needs it to build an origin; the form under test
    // depends only on the error Better Auth returns, which the plugin does not change.
    const auth = createAuthClient({
      baseURL: API_URL,
      basePath: '/api/auth',
      fetchOptions: {
        customFetchImpl: fakeTransport({
          'POST /api/auth/sign-in/email': () =>
            json(401, { message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' }),
        }),
      },
    })
    const user = userEvent.setup()

    await render(
      <QueryClientProvider client={new QueryClient()}>
        <SignInForm auth={auth} onSignedIn={onSignedIn} />
      </QueryClientProvider>,
    )

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.press(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password')
    expect(onSignedIn).not.toHaveBeenCalled()
  })
})
