import { fakeTransport, json } from '@test/support/fake-transport'
import { createTestQueryClient } from '@test/support/query-client'
import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Profile } from '@/api-contract'
import { createClients } from '@/features/clients/clients'
import { island } from '@/features/clients/island'
import { keepChoice } from '@/i18n/choice'
import { BASE_LOCALE, LOCALES, segmentOf } from '@/i18n/locales'
import { navigate } from '@/lib/navigate'

// Any language of the project's other than the base; a project that speaks one has nothing to switch to.
const other = LOCALES.find((locale) => locale !== BASE_LOCALE) ?? BASE_LOCALE

const Inside = island(() => <p>in</p>, { signedIn: true })

function signedIn(locale: Profile['locale'], patches: unknown[] = []) {
  const profile: Profile = {
    id: 'profile-1',
    userId: 'user-1',
    displayName: 'Ana',
    locale,
    timezone: 'UTC',
    createdAt: '2026-09-14T12:57:24.057Z',
    updatedAt: '2026-09-14T12:57:24.057Z',
  }

  return createClients(
    'http://api.test',
    fakeTransport({
      'GET /api/auth/session': () =>
        json(200, { user: { id: 'user-1', email: 'ana@example.com' } }),
      'GET /api/v1/users/me': () => json(200, profile),
      'PATCH /api/v1/users/me': async (request) => {
        patches.push(await request.json())
        return json(200, profile)
      },
    }),
  )
}

describe.runIf(LOCALES.length > 1)('the signed-in area’s language', () => {
  it('moves to the account’s language where nothing was chosen here', async () => {
    window.history.replaceState(null, '', `/${segmentOf(BASE_LOCALE)}/account`)

    render(<Inside clients={signedIn(other)} queryClient={createTestQueryClient()} />)

    await waitFor(() => expect(navigate.to).toHaveBeenCalledWith(`/${segmentOf(other)}/account`))
  })

  it('gives the account the language the page speaks, once one was chosen here', async () => {
    const patches: unknown[] = []

    keepChoice(BASE_LOCALE)
    render(
      <Inside
        clients={signedIn(other, patches)}
        queryClient={createTestQueryClient()}
        locale={BASE_LOCALE}
      />,
    )

    await waitFor(() => expect(patches).toEqual([{ locale: BASE_LOCALE }]))
  })
})
