import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { userEvent } from '@testing-library/react-native'
import { renderRouter, screen } from 'expo-router/testing-library'
import type { ReactNode } from 'react'
import { Text } from 'react-native'
import { createAuthClient, createClient } from '@/api-contract'
import ForgotPasswordScreen from '@/app/(auth)/forgot-password'
import ResetPasswordScreen from '@/app/(auth)/reset-password'
import SignUpScreen from '@/app/(auth)/sign-up'
import VerifyEmailScreen from '@/app/(auth)/verify-email'
import { ClientsProvider } from '@/features/clients/clients-context'

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }

async function renderAt(initialUrl: string, routes: Parameters<typeof fakeTransport>[0]) {
  const transport = fakeTransport(routes)
  const auth = createAuthClient({ baseUrl: API_URL, fetch: transport, tokens: memoryTokenStore() })
  const clients = { auth, api: createClient({ baseUrl: API_URL, fetch: auth.fetch }) }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ClientsProvider clients={clients}>{children}</ClientsProvider>
      </QueryClientProvider>
    )
  }

  await renderRouter(
    {
      index: () => <Text>Your profile</Text>,
      '(auth)/sign-up': SignUpScreen,
      '(auth)/verify-email': VerifyEmailScreen,
      '(auth)/forgot-password': ForgotPasswordScreen,
      '(auth)/reset-password': ResetPasswordScreen,
    },
    { initialUrl, wrapper: Providers },
  )
}

describe('email verification on mobile', () => {
  it('takes a new account to the code, and in once it is entered', async () => {
    const user = userEvent.setup()

    await renderAt('/sign-up', {
      'POST /api/auth/sign-up': () => json(201, { verificationRequired: true }),
      'POST /api/auth/email/verify': () => json(200, TOKENS),
    })

    await user.type(screen.getByLabelText('Name'), 'Ana')
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await user.press(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Confirm your email')).toBeOnTheScreen()

    await user.type(screen.getByLabelText('Code'), '123456')
    await user.press(screen.getByRole('button', { name: 'Confirm email' }))

    expect(await screen.findByText('Your profile')).toBeOnTheScreen()
  })
})

describe('password reset on mobile', () => {
  it('goes from forgot to reset and in', async () => {
    const user = userEvent.setup()

    await renderAt('/forgot-password', {
      'POST /api/auth/password/forgot': () => new Response(null, { status: 204 }),
      'POST /api/auth/password/reset': () => json(200, TOKENS),
    })

    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.press(screen.getByRole('button', { name: 'Send a reset code' }))

    expect(await screen.findByText('Choose a new password')).toBeOnTheScreen()

    await user.type(screen.getByLabelText('Code'), '123456')
    await user.type(screen.getByLabelText('New password'), 'another-good-password')
    await user.press(screen.getByRole('button', { name: 'Set the new password' }))

    expect(await screen.findByText('Your profile')).toBeOnTheScreen()
  })
})
