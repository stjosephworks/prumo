import { QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { createTestQueryClient } from '@test/support/query-client'
import { render, screen, userEvent, within } from '@testing-library/react-native'
import { createClient, type Profile } from '@/api-contract'
import { ProfileForm } from '@/features/profile/profile-form'
import { BASE_LOCALE } from '@/i18n/locales'

const profile: Profile = {
  id: '01a09ffe-635c-77e5-9aeb-d3e9d1a7ee24',
  userId: 'ef51f640-611b-4b9a-a188-510c455539eb',
  displayName: 'Ana',
  locale: BASE_LOCALE,
  timezone: 'UTC',
  createdAt: '2026-09-14T12:57:24.057Z',
  updatedAt: '2026-09-14T12:57:24.057Z',
}

describe('ProfileForm', () => {
  it('puts a server validation message on the field it names', async () => {
    const api = createClient({
      baseUrl: API_URL,
      fetch: fakeTransport({
        'PATCH /api/v1/users/me': () =>
          json(
            400,
            {
              type: 'about:blank',
              title: 'Bad Request',
              status: 400,
              detail: 'Validation failed',
              instance: '/api/v1/users/me',
              requestId: 'req-1',
              errors: { timezone: ['timezone must be a valid IANA zone'] },
            },
            'application/problem+json',
          ),
      }),
    })

    const queryClient = createTestQueryClient()

    await render(
      <QueryClientProvider client={queryClient}>
        <ProfileForm api={api} profile={profile} />
      </QueryClientProvider>,
    )

    await userEvent.setup().press(screen.getByRole('button', { name: 'Save' }))

    expect(
      await within(screen.getByTestId('field-Timezone')).findByText(
        'timezone must be a valid IANA zone',
      ),
    ).toBeOnTheScreen()
    expect(
      within(screen.getByTestId('field-Display name')).queryByText(
        'timezone must be a valid IANA zone',
      ),
    ).toBeNull()
  })
})
