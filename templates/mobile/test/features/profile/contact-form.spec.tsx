import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { memoryTokenStore } from '@test/support/memory-token-store'
import { createTestQueryClient } from '@test/support/query-client'
import { render, screen, userEvent } from '@testing-library/react-native'
import { createAuthClient, createClient } from '@/api-contract'
import { ContactForm } from '@/features/profile/contact-form'

// MMKV is native; signing out clears what it holds, which a test only needs to see asked for.
jest.mock('@/features/storage/storage', () => ({ clearUserData: jest.fn() }))

const empty = (status: number) => new Response(null, { status })

// A signed-in person whose addresses change as the fake API is told.
async function renderContact(
  routes: (user: Record<string, string | null>) => Parameters<typeof fakeTransport>[0],
) {
  const user: Record<string, string | null> = {
    id: 'user-1',
    email: 'ana@example.com',
    phone: null,
  }
  const tokens = memoryTokenStore()

  await tokens.write({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 })

  const transport = fakeTransport({
    'GET /api/auth/session': () => json(200, { user }),
    ...routes(user),
  })
  const auth = createAuthClient({ baseUrl: API_URL, fetch: transport, tokens })
  const api = createClient({ baseUrl: API_URL, fetch: auth.fetch })
  const onSignedOut = jest.fn()

  await render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ContactForm api={api} auth={auth} onSignedOut={onSignedOut} />
    </QueryClientProvider>,
  )

  return { onSignedOut }
}

describe('ContactForm', () => {
  // prumo:mail
  it('changes the email with a code sent to the new address', async () => {
    const visitor = userEvent.setup()

    await renderContact((user) => ({
      'POST /api/v1/users/me/email/code': () => empty(204),
      'POST /api/v1/users/me/email': () => {
        user.email = 'new@example.com'
        return json(200, { user })
      },
    }))

    await visitor.press(await screen.findByRole('button', { name: 'Change your email' }))
    await visitor.type(screen.getByLabelText('New email'), 'new@example.com')
    await visitor.press(screen.getByRole('button', { name: 'Send a code there' }))
    await visitor.type(await screen.findByLabelText('Code'), '123456')
    await visitor.press(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Email: new@example.com')).toBeOnTheScreen()
  })

  it('signs out to sign in again when the last sign-in is too old', async () => {
    const visitor = userEvent.setup()
    const { onSignedOut } = await renderContact(() => ({
      'POST /api/v1/users/me/email/code': () =>
        json(
          403,
          { status: 403, title: 'Forbidden', code: 'reauthentication_required' },
          'application/problem+json',
        ),
      'POST /api/auth/sign-out': () => empty(204),
    }))

    await visitor.press(await screen.findByRole('button', { name: 'Change your email' }))
    await visitor.type(screen.getByLabelText('New email'), 'new@example.com')
    await visitor.press(screen.getByRole('button', { name: 'Send a code there' }))
    await visitor.press(await screen.findByRole('button', { name: 'Sign in again' }))

    expect(onSignedOut).toHaveBeenCalled()
  })
  // prumo:end-mail

  // prumo:sms
  it('adds a phone with a code texted to it', async () => {
    const visitor = userEvent.setup()

    await renderContact((user) => ({
      'POST /api/v1/users/me/phone/code': () => empty(204),
      'POST /api/v1/users/me/phone': () => {
        user.phone = '+14155552671'
        return json(200, { user })
      },
    }))

    await visitor.press(await screen.findByRole('button', { name: 'Add a phone number' }))
    await visitor.type(screen.getByLabelText('New phone number'), '+1 415 555 2671')
    await visitor.press(screen.getByRole('button', { name: 'Send a code there' }))
    await visitor.type(await screen.findByLabelText('Code'), '123456')
    await visitor.press(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Phone number: +14155552671')).toBeOnTheScreen()
  })
  // prumo:end-sms
})
