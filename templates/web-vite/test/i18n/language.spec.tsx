import { fakeTransport, json } from '@test/support/fake-transport'
import { messages } from '@test/support/messages'
import { renderApp } from '@test/support/render-app'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@/api-contract'
import { currentLocale } from '@/i18n/i18n'
import { BASE_LOCALE, LOCALES } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

// Any language of the project's other than the base; a project that speaks one has nothing to switch to.
const other = LOCALES.find((locale) => locale !== BASE_LOCALE) ?? BASE_LOCALE

const signedOut = {
  'GET /api/auth/session': () => json(401, {}),
  'POST /api/auth/refresh': () => json(401, {}),
}

function signedIn(locale: Profile['locale'], patches: unknown[] = []) {
  // The API changes the profile as it is asked, so a refetch reads the new language.
  let profile: Profile = {
    id: 'profile-1',
    userId: 'user-1',
    displayName: 'Ana',
    locale,
    timezone: 'UTC',
    createdAt: '2026-09-14T12:57:24.057Z',
    updatedAt: '2026-09-14T12:57:24.057Z',
  }

  return {
    'GET /api/auth/session': () => json(200, { user: { id: 'user-1', email: 'ana@example.com' } }),
    'GET /api/v1/users/me': () => json(200, profile),
    'PATCH /api/v1/users/me': async (request: Request) => {
      const changes = (await request.json()) as Partial<Profile>

      patches.push(changes)
      profile = { ...profile, ...changes }
      return json(200, profile)
    },
  }
}

describe.runIf(LOCALES.length > 1)('the language of the screen', () => {
  it('speaks the language chosen, keeps it on this browser, and names it to the API', async () => {
    const visitor = userEvent.setup()
    const asked: (string | null)[] = []

    renderApp(
      '/',
      fakeTransport({
        'GET /api/auth/session': (request) => {
          asked.push(request.headers.get('accept-language'))
          return json(401, {})
        },
        'POST /api/auth/refresh': () => json(401, {}),
      }),
    )

    await screen.findByRole('heading', { name: messages.auth.signIn.title })
    expect(asked[0]).toBe(BASE_LOCALE)

    await visitor.selectOptions(screen.getByLabelText(messages.language), other)

    expect(
      await screen.findByRole('heading', { name: messagesFor(other).auth.signIn.title }),
    ).toBeInTheDocument()
    expect(document.documentElement.lang).toBe(other)
    expect(localStorage.getItem('locale')).toBe(other)
    // What withLanguage writes into every request from now on.
    expect(currentLocale()).toBe(other)
  })

  it('speaks the account’s language where nothing was chosen here', async () => {
    renderApp('/', fakeTransport({ ...signedOut, ...signedIn(other) }))

    expect(
      await screen.findByRole('heading', { name: messagesFor(other).profile.title }),
    ).toBeInTheDocument()
  })

  it('gives the account the language chosen here, so mail arrives in it', async () => {
    const patches: unknown[] = []

    localStorage.setItem('locale', other)
    renderApp('/', fakeTransport({ ...signedOut, ...signedIn(BASE_LOCALE, patches) }))

    expect(
      await screen.findByRole('heading', { name: messagesFor(other).profile.title }),
    ).toBeInTheDocument()
    await waitFor(() => expect(patches).toEqual([{ locale: other }]))
  })
})
