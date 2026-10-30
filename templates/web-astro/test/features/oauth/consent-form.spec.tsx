import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { messages } from '@test/support/messages'
import { createTestQueryClient } from '@test/support/query-client'
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
  scopes: [
    { scope: 'profile:read', description: 'Read your profile' },
    { scope: 'profile:write', description: 'Change your display name, language and timezone' },
  ],
}

function renderForm(routes: Parameters<typeof fakeTransport>[0]) {
  const leave = vi.fn()
  const auth = createAuthClient({ baseUrl: API_URL, fetch: fakeTransport(routes) })

  render(
    <QueryClientProvider client={createTestQueryClient()}>
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
    expect(screen.getByRole('list', { name: messages.consent.abilities })).toHaveTextContent(
      'Read your profile',
    )

    await visitor.click(screen.getByRole('button', { name: messages.consent.allow }))

    expect(decision).toEqual({ accept: true })
    expect(leave).toHaveBeenCalledWith('https://claude.example.com/callback?code=c')
  })

  it('warns when the code returns to a program on this device', async () => {
    renderForm({
      [`GET /api/oauth/authorizations/${REQUEST}`]: () =>
        json(200, { ...view, redirectHost: 'localhost:33418', redirectsToThisDevice: true }),
    })

    expect(await screen.findByRole('note')).toHaveTextContent(messages.consent.device)
  })

  it('says so when the request has expired', async () => {
    renderForm({
      [`GET /api/oauth/authorizations/${REQUEST}`]: () =>
        json(404, { title: 'Not Found', status: 404 }, 'application/problem+json'),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.consent.expired)
  })
})
