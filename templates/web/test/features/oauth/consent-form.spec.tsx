import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { renderApp } from '@test/support/render-app'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createAuthClient } from '@/api-contract'
import { ConsentForm } from '@/features/oauth/consent-form'

const REQUEST = '0199a7e2-0000-7000-8000-000000000000'

const view = {
  clientId: 'https://claude.example.com/client.json',
  clientName: 'Claude',
  clientHost: 'claude.example.com',
  redirectHost: 'claude.example.com',
  redirectsToThisDevice: false,
}

function renderForm(routes: Parameters<typeof fakeTransport>[0]) {
  const leave = vi.fn()
  const auth = createAuthClient({ baseUrl: API_URL, fetch: fakeTransport(routes) })

  render(
    <QueryClientProvider client={new QueryClient()}>
      <ConsentForm auth={auth} requestId={REQUEST} leave={leave} />
    </QueryClientProvider>,
  )

  return leave
}

describe('ConsentForm', () => {
  it('names the client and both hosts, and sends the browser where the API says', async () => {
    const visitor = userEvent.setup()
    let decision: unknown
    const leave = renderForm({
      [`GET /api/oauth/authorizations/${REQUEST}`]: () => json(200, view),
      [`POST /api/oauth/authorizations/${REQUEST}/decision`]: async (request) => {
        decision = await request.json()
        return json(200, { redirectTo: 'https://claude.example.com/callback?code=c' })
      },
    })

    expect(await screen.findByText('Claude')).toBeInTheDocument()
    expect(screen.getByText(/claude\.example\.com\)/)).toBeInTheDocument()

    await visitor.click(screen.getByRole('button', { name: 'Allow' }))

    expect(decision).toEqual({ accept: true })
    expect(leave).toHaveBeenCalledWith('https://claude.example.com/callback?code=c')
  })

  it('warns when the code returns to a program on this device', async () => {
    renderForm({
      [`GET /api/oauth/authorizations/${REQUEST}`]: () =>
        json(200, { ...view, redirectHost: 'localhost:33418', redirectsToThisDevice: true }),
    })

    expect(await screen.findByRole('note')).toHaveTextContent('a program on this device')
  })

  it('says so when the request has expired', async () => {
    renderForm({
      [`GET /api/oauth/authorizations/${REQUEST}`]: () =>
        json(404, { title: 'Not Found', status: 404 }, 'application/problem+json'),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('expired')
  })
})

describe('the consent route', () => {
  // The MCP client opened the browser at the API, which sent it here; without a session, sign-in comes first.
  it('sends a visitor to sign in first, and back to the same request after', async () => {
    const visitor = userEvent.setup()
    let signedIn = false

    renderApp(
      `/consent?request=${REQUEST}`,
      fakeTransport({
        'GET /api/auth/session': () =>
          signedIn
            ? json(200, { user: { id: 'user-1', email: 'ana@example.com' } })
            : json(401, {}),
        'POST /api/auth/refresh': () => json(401, {}),
        'POST /api/auth/sign-in': () => {
          signedIn = true
          return new Response(null, { status: 204 })
        },
        [`GET /api/oauth/authorizations/${REQUEST}`]: () => json(200, view),
      }),
    )

    await visitor.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await visitor.type(screen.getByLabelText('Password'), 'correct-horse-battery')
    await visitor.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('heading', { name: 'Allow access' })).toBeInTheDocument()
    expect(await screen.findByText('Claude')).toBeInTheDocument()
  })
})
