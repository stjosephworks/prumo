import { fakeTransport, json } from '@test/support/fake-transport'
import { renderApp } from '@test/support/render-app'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'

const user = { id: 'user-1', email: 'ana@example.com', name: 'Ana' }

// The shape Better Auth signs: every signed name listed in ba_param, then the signature.
const SIGNED =
  'client_id=client-1&scope=openid+profile&ba_param=ba_param&ba_param=client_id&ba_param=scope&sig=signature'

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('ConsentForm', () => {
  it('names the client, lists the scopes and sends the signed query with the answer', async () => {
    const visitor = userEvent.setup()
    let consent: Record<string, unknown> | undefined

    // The OAuth client plugin reads the browser's own URL, not the router's memory history.
    window.history.replaceState(null, '', `/consent?${SIGNED}&unrelated=1`)

    renderApp(
      `/consent?${SIGNED}`,
      fakeTransport({
        'GET /api/auth/get-session': () =>
          json(200, { session: { id: 's-1', userId: user.id }, user }),
        'GET /api/auth/oauth2/public-client': () => json(200, { client_name: 'Claude' }),
        'POST /api/auth/oauth2/consent': async (request) => {
          consent = await request.json()
          return json(200, { redirect: false })
        },
      }),
    )

    expect(await screen.findByText('Claude')).toBeInTheDocument()
    expect(screen.getByText('profile')).toBeInTheDocument()

    await visitor.click(screen.getByRole('button', { name: 'Allow' }))

    expect(consent).toMatchObject({ accept: true, oauth_query: SIGNED })
  })
})
