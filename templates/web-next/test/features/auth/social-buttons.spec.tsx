import { API_URL, fakeTransport } from '@test/support/fake-transport'
import { messages } from '@test/support/messages'
import { renderAt } from '@test/support/render'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SocialSignIn } from '@/features/auth/social-buttons'

describe('SocialSignIn', () => {
  it('send the browser to the API, which returns it to the page it was turned away from', async () => {
    renderAt('/sign-in?redirect=%2Forders', <SocialSignIn />, fakeTransport({}))

    for (const name of [
      messages.auth.social.google, // prumo:google
      messages.auth.social.apple, // prumo:apple
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
    renderAt('/sign-in?error=provider_email_unverified', <SocialSignIn />, fakeTransport({}))

    expect(await screen.findByRole('alert')).toHaveTextContent(messages.auth.social.emailUnverified)
  })

  // prumo:apple
  it('says the account was deleted, when Apple brought the person back from deleting it', async () => {
    renderAt('/sign-in?deleted=1', <SocialSignIn />, fakeTransport({}))

    expect(await screen.findByRole('status')).toHaveTextContent(messages.auth.social.deleted)
  })
  // prumo:end-apple
})
