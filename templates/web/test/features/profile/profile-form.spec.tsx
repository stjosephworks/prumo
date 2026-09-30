import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { API_URL, fakeTransport, json } from '@test/support/fake-transport'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { createClient, type Profile } from '@/api-contract'
import { ProfileForm } from '@/features/profile/profile-form'

const profile: Profile = {
  id: '01a09ffe-635c-77e5-9aeb-d3e9d1a7ee24',
  userId: 'ef51f640-611b-4b9a-a188-510c455539eb',
  displayName: 'Ana',
  locale: 'en',
  timezone: 'UTC',
  createdAt: '2026-09-14T12:57:24.057Z',
  updatedAt: '2026-09-14T12:57:24.057Z',
}

describe('ProfileForm', () => {
  it('puts a server validation message on the field it names', async () => {
    const user = userEvent.setup()
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

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileForm api={api} profile={profile} />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Save' }))

    const timezone = screen.getByLabelText('Timezone').closest('[data-slot="field"]')

    expect(timezone).not.toBeNull()
    expect(timezone).toHaveTextContent('timezone must be a valid IANA zone')
    expect(
      screen.getByLabelText('Display name').closest('[data-slot="field"]'),
    ).not.toHaveTextContent('timezone must be a valid IANA zone')
  })
})
