import { queryOptions } from '@tanstack/react-query'
import type { Locale } from '@/i18n/locales'
import type { ApiClient } from './client'

export type Profile = {
  id: string
  userId: string
  displayName: string
  locale: Locale
  timezone: string
  createdAt: string
  updatedAt: string
}

export type UpdateProfileRequest = Partial<Pick<Profile, 'displayName' | 'locale' | 'timezone'>>

export const profileQuery = (client: ApiClient) =>
  queryOptions({
    queryKey: ['profile', 'me'],
    queryFn: () => client.get<Profile>('/users/me'),
  })

export const updateProfile = (client: ApiClient, changes: UpdateProfileRequest) =>
  client.patch<Profile>('/users/me', changes)
