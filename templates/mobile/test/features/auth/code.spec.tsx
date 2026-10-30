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
import SignInScreen from '@/app/(auth)/sign-in'
import { ClientsProvider } from '@/features/clients/clients-context'
import { format } from '@/i18n/locales'

const TOKENS = { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 }

const throttled = () =>
  new Response(
    JSON.stringify({ status: 429, title: 'Too Many Requests', code: 'too_many_codes' }),
    {
      status: 429,
      headers: { 'content-type': 'application/problem+json', 'retry-after': '42' },
    },
  )

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
    { index: () => <Text>{messages.profile.title}</Text>, '(auth)/sign-in': SignInScreen },
    { initialUrl, wrapper: Providers },
  )
}

// prumo:phone-code
// With email beside it, the phone waits behind a switch; alone, it is already there.
async function byPhone(user: ReturnType<typeof userEvent.setup>) {
  const toPhone = screen.queryByRole('button', { name: messages.auth.code.usePhone })

  if (toPhone !== null) {
    await user.press(toPhone)
  }
}

// prumo:end-phone-code
describe('signing in with a code on mobile', () => {
  // prumo:email-code
  it('sends a code to the address and signs in with it', async () => {
    const user = userEvent.setup()

    await renderAt('/sign-in', {
      'POST /api/auth/email/code': () => new Response(null, { status: 204 }),
      'POST /api/auth/email/sign-in': () => json(200, TOKENS),
    })

    await user.type(screen.getByLabelText(messages.auth.email), 'ana@example.com')
    await user.press(screen.getByRole('button', { name: messages.auth.code.send }))
    await user.type(await screen.findByLabelText(messages.forms.code), '123456')
    await user.press(screen.getByRole('button', { name: messages.auth.signIn.submit }))

    expect(await screen.findByText(messages.profile.title)).toBeOnTheScreen()
  })

  it('goes on to the code when one was sent moments ago, counting down to the next', async () => {
    const user = userEvent.setup()

    await renderAt('/sign-in', { 'POST /api/auth/email/code': throttled })

    await user.type(screen.getByLabelText(messages.auth.email), 'ana@example.com')
    await user.press(screen.getByRole('button', { name: messages.auth.code.send }))

    expect(await screen.findByLabelText(messages.forms.code)).toBeOnTheScreen()
    expect(
      screen.getByRole('button', { name: format(messages.forms.sendNewCodeIn, { seconds: 42 }) }),
    ).toBeDisabled()
  })
  // prumo:end-email-code

  // prumo:phone-code
  it('texts a code to the number and signs in with it', async () => {
    const user = userEvent.setup()

    await renderAt('/sign-in', {
      'POST /api/auth/phone/code': () => new Response(null, { status: 204 }),
      'POST /api/auth/phone/sign-in': () => json(200, TOKENS),
    })

    await byPhone(user)
    await user.type(screen.getByLabelText(messages.auth.code.phone), '+1 415 555 2671')
    await user.press(screen.getByRole('button', { name: messages.auth.code.send }))
    await user.type(await screen.findByLabelText(messages.forms.code), '123456')
    await user.press(screen.getByRole('button', { name: messages.auth.signIn.submit }))

    expect(await screen.findByText(messages.profile.title)).toBeOnTheScreen()
  })
  // prumo:end-phone-code

  // prumo:password
  it('leads with the code, and keeps the password behind a link', async () => {
    const user = userEvent.setup()

    await renderAt('/sign-in', {})

    expect(screen.queryByLabelText(messages.auth.signIn.password)).toBeNull()

    await user.press(screen.getByRole('button', { name: messages.auth.signIn.withPassword }))

    expect(await screen.findByLabelText(messages.auth.signIn.password)).toBeOnTheScreen()
  })
  // prumo:end-password
})
