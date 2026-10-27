import { API_URL, fakeTransport } from '@test/support/fake-transport'
import { renderIsland } from '@test/support/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SocialSignIn } from '@/features/auth/social-buttons'

describe('SocialSignIn', () => {
  it('send the browser to the API, which returns it to the page it was turned away from', async () => {
    renderIsland('/sign-in?redirect=%2Forders', SocialSignIn, fakeTransport({}))

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
      expect(href.searchParams.get('origin')).toBe(window.location.origin)
    }
  })

  it('says why a provider sign-in came back without a session', async () => {
    renderIsland('/sign-in?error=provider_email_unverified', SocialSignIn, fakeTransport({}))

    expect(await screen.findByRole('alert')).toHaveTextContent('not verified with the provider')
  })
})
