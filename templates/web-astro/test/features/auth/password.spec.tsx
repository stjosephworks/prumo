import { fakeTransport, json } from '@test/support/fake-transport'
import { renderIsland } from '@test/support/render'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SignIn } from '@/features/auth/sign-in-form'
import { navigate } from '@/lib/navigate'

const user = { id: 'user-1', email: 'ana@example.com' }

describe('SignIn', () => {
  it('shows a rejected sign-in as a form-level error', async () => {
    const visitor = userEvent.setup()

    renderIsland(
      '/sign-in',
      SignIn,
      fakeTransport({
        'POST /api/auth/sign-in': () =>
          json(
            401,
            { title: 'Unauthorized', status: 401, detail: 'Invalid email or password' },
            'application/problem+json',
          ),
      }),
    )

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.type(screen.getByLabelText('Password'), 'wrong-password')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    const form = screen.getByRole('button', { name: 'Sign in' }).closest('form')

    expect(form).not.toBeNull()
    expect(
      await within(form as HTMLFormElement).findByText('Invalid email or password'),
    ).toBeInTheDocument()
  })

  it('takes a visitor who signs in to the page they were turned away from', async () => {
    const visitor = userEvent.setup()
    let signedIn = false

    renderIsland(
      `/sign-in?${new URLSearchParams({ redirect: '/consent?request=abc' })}`,
      SignIn,
      fakeTransport({
        'GET /api/auth/session': () => (signedIn ? json(200, { user }) : json(401, {})),
        'POST /api/auth/refresh': () => json(401, {}),
        'POST /api/auth/sign-in': () => {
          signedIn = true
          return new Response(null, { status: 204 })
        },
      }),
    )

    await visitor.type(await screen.findByLabelText('Email'), user.email)
    await visitor.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith('/consent?request=abc'))
  })
})
