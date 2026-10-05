import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { renderApp } from '@test/support/render-app'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

const signedOut = fakeTransport({
  'GET /api/auth/session': () => json(401, {}),
  'POST /api/auth/refresh': () => json(401, {}),
})

describe('SocialButtons', () => {
  it('send the browser to the API, which returns it to the page it was turned away from', async () => {
    renderApp('/sign-in?redirect=%2Forders', signedOut)

    for (const name of [
      'Continue with Google', // prumo:google
      'Continue with Apple', // prumo:apple
    ]) {
      const link = await screen.findByRole('link', { name })
      const href = new URL(link.getAttribute('href') ?? '')

      expect(`${href.origin}${href.pathname}`).toMatch(
        new RegExp(`^${API_URL}/api/auth/social/(google|apple)$`),
      )
      expect(href.searchParams.get('client')).toBe('web')
      expect(href.searchParams.get('returnTo')).toBe('/orders')
    }
  })

  it('says why a provider sign-in came back without a session', async () => {
    renderApp('/sign-in?error=provider_email_unverified', signedOut)

    expect(await screen.findByRole('alert')).toHaveTextContent('not verified with the provider')
  })
})
