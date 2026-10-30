import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { messages } from '@test/support/messages'
import { createTestQueryClient } from '@test/support/query-client'
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
import { format } from '@/i18n/locales'

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }

async function renderAt(initialUrl: string, routes: Parameters<typeof fakeTransport>[0]) {
  const transport = fakeTransport(routes)
  const auth = createAuthClient({ baseUrl: API_URL, fetch: transport, tokens: memoryTokenStore() })
  const clients = { auth, api: createClient({ baseUrl: API_URL, fetch: auth.fetch }) }
  const queryClient = createTestQueryClient()

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ClientsProvider clients={clients}>{children}</ClientsProvider>
      </QueryClientProvider>
    )
  }

  await renderRouter(
    {
      index: () => <Text>{messages.profile.title}</Text>,
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

    await user.type(screen.getByLabelText(messages.auth.signUp.name), 'Ana')
    await user.type(screen.getByLabelText(messages.auth.email), 'ana@example.com')
    await user.type(screen.getByLabelText(messages.auth.signIn.password), 'correct-horse-battery')
    await user.press(screen.getByRole('button', { name: messages.auth.signUp.submit }))

    expect(await screen.findByText(messages.auth.verifyEmail.title)).toBeOnTheScreen()

    await user.type(screen.getByLabelText(messages.forms.code), '123456')
    await user.press(screen.getByRole('button', { name: messages.auth.verifyEmail.submit }))

    expect(await screen.findByText(messages.profile.title)).toBeOnTheScreen()
  })
})

describe('a new code on mobile', () => {
  it('counts down to the next code when one was sent moments ago', async () => {
    const user = userEvent.setup()

    await renderAt('/verify-email?email=ana@example.com', {
      'POST /api/auth/email/verification': () =>
        new Response(
          JSON.stringify({ status: 429, title: 'Too Many Requests', code: 'too_many_codes' }),
          {
            status: 429,
            headers: { 'content-type': 'application/problem+json', 'retry-after': '42' },
          },
        ),
    })

    await user.press(screen.getByRole('button', { name: messages.forms.sendNewCode }))

    expect(
      await screen.findByRole('button', {
        name: format(messages.forms.sendNewCodeIn, { seconds: 42 }),
      }),
    ).toBeDisabled()
  })
})

describe('password reset on mobile', () => {
  it('goes from forgot to reset and in', async () => {
    const user = userEvent.setup()

    await renderAt('/forgot-password', {
      'POST /api/auth/password/forgot': () => new Response(null, { status: 204 }),
      'POST /api/auth/password/reset': () => json(200, TOKENS),
    })

    await user.type(screen.getByLabelText(messages.auth.email), 'ana@example.com')
    await user.press(screen.getByRole('button', { name: messages.auth.forgotPassword.submit }))

    expect(await screen.findByText(messages.auth.resetPassword.title)).toBeOnTheScreen()

    await user.type(screen.getByLabelText(messages.forms.code), '123456')
    await user.type(
      screen.getByLabelText(messages.auth.resetPassword.password),
      'another-good-password',
    )
    await user.press(screen.getByRole('button', { name: messages.auth.resetPassword.submit }))

    expect(await screen.findByText(messages.profile.title)).toBeOnTheScreen()
  })
})
