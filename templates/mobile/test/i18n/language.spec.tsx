import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { messages } from '@test/support/messages'
import { createTestQueryClient } from '@test/support/query-client'
import { render, screen, userEvent, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { createClient, type Profile } from '@/api-contract'
import { useAccountLanguage } from '@/features/i18n/account-language'
import { LanguageSwitcher } from '@/features/i18n/language-switcher'
import { storage } from '@/features/storage/storage'
import { I18nProvider, useMessages } from '@/i18n/i18n'
import { BASE_LOCALE, LOCALE_INFO, LOCALES } from '@/i18n/locales'
import { messagesFor } from '@/i18n/messages'

// Any language of the project's other than the base; a project that speaks one has nothing to switch to.
const other = LOCALES.find((locale) => locale !== BASE_LOCALE) ?? BASE_LOCALE

function Words() {
  return <Text>{useMessages().profile.title}</Text>
}

function Account({ api }: { api: ReturnType<typeof createClient> }) {
  useAccountLanguage(api)

  return <Words />
}

function account(locale: Profile['locale'], patches: unknown[] = []) {
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

  return createClient({
    baseUrl: API_URL,
    fetch: fakeTransport({
      'GET /api/v1/users/me': () => json(200, profile),
      'PATCH /api/v1/users/me': async (request) => {
        const changes = (await request.json()) as Partial<Profile>

        patches.push(changes)
        profile = { ...profile, ...changes }
        return json(200, profile)
      },
    }),
  })
}

async function renderWith(ui: React.ReactNode) {
  await render(
    <QueryClientProvider client={createTestQueryClient()}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  storage.remove('locale')
})

const describeIfSeveral = LOCALES.length > 1 ? describe : describe.skip

describeIfSeveral('the app’s language', () => {
  it('speaks the language chosen, and keeps it on the phone', async () => {
    await renderWith(
      <>
        <LanguageSwitcher />
        <Words />
      </>,
    )

    expect(screen.getByText(messages.profile.title)).toBeOnTheScreen()

    await userEvent.setup().press(screen.getByLabelText(LOCALE_INFO[other].nativeName))

    expect(await screen.findByText(messagesFor(other).profile.title)).toBeOnTheScreen()
    expect(storage.getString('locale')).toBe(other)
  })

  it('speaks the account’s language where nothing was chosen in the app', async () => {
    await renderWith(<Account api={account(other)} />)

    expect(await screen.findByText(messagesFor(other).profile.title)).toBeOnTheScreen()
  })

  it('gives the account the language chosen in the app, so mail arrives in it', async () => {
    const patches: unknown[] = []

    storage.set('locale', BASE_LOCALE)
    await renderWith(<Account api={account(other, patches)} />)

    await waitFor(() => expect(patches).toEqual([{ locale: BASE_LOCALE }]))
  })
})
