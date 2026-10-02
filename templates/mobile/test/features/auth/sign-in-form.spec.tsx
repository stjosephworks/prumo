import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { render, screen, userEvent } from '@testing-library/react-native'
import { createAuthClient } from '@/api-contract'
import { SignInForm } from '@/features/auth/sign-in-form'

describe('SignInForm', () => {
  it('shows a rejected sign-in as a form-level error', async () => {
    const onSignedIn = jest.fn()
    const auth = createAuthClient({
      baseUrl: API_URL,
      tokens: memoryTokenStore(),
      fetch: fakeTransport({
        'POST /api/auth/sign-in': () =>
          json(
            401,
            { title: 'Unauthorized', status: 401, detail: 'Invalid email or password' },
            'application/problem+json',
          ),
      }),
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
