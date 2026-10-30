import { fakeTransport, json } from '@test/support/fake-transport'
import { messages } from '@test/support/messages'
import { router } from '@test/support/navigation'
import { renderAt } from '@test/support/render'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@/api-contract'
import { SignedIn } from '@/features/auth/signed-in'
import { LanguageSwitcher } from '@/features/i18n/language-switcher'
import { BASE_LOCALE, LOCALES, segmentOf } from '@/i18n/locales'

// Any language of the project's other than the base; a project that speaks one has nothing to switch to.
const other = LOCALES.find((locale) => locale !== BASE_LOCALE) ?? BASE_LOCALE

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

  return fakeTransport({
    'GET /api/auth/session': () => json(200, { user: { id: 'user-1', email: 'ana@example.com' } }),
    'GET /api/v1/users/me': () => json(200, profile),
    'PATCH /api/v1/users/me': async (request) => {
      const changes = (await request.json()) as Partial<Profile>

      patches.push(changes)
      profile = { ...profile, ...changes }
      return json(200, profile)
    },
  })
}

describe.runIf(LOCALES.length > 1)('the language of the address', () => {
  it('moves to the language chosen, at the same address, and keeps the choice', async () => {
    const visitor = userEvent.setup()

    renderAt(
      `/${segmentOf(BASE_LOCALE)}/sign-in?redirect=%2Fx`,
      <LanguageSwitcher />,
      signedIn(other),
    )

    await visitor.selectOptions(screen.getByLabelText(messages.language), other)

    expect(router.push).toHaveBeenCalledWith(`/${segmentOf(other)}/sign-in?redirect=%2Fx`)
    expect(document.cookie).toContain(`locale=${other}`)
  })

  it('moves to the account’s language where nothing was chosen here', async () => {
    renderAt(`/${segmentOf(BASE_LOCALE)}/account`, <SignedIn>in</SignedIn>, signedIn(other))

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/${segmentOf(other)}/account`))
  })

  it('gives the account the language the screen speaks, once one was chosen here', async () => {
    const patches: unknown[] = []

    document.cookie = `locale=${BASE_LOCALE}; path=/`
    renderAt(
      `/${segmentOf(BASE_LOCALE)}/account`,
      <SignedIn>in</SignedIn>,
      signedIn(other, patches),
    )

    await waitFor(() => expect(patches).toEqual([{ locale: BASE_LOCALE }]))
  })
})
