import { queryOptions } from '@tanstack/react-query'
import type { ApiClient } from './client'

export const LOCALES = ['en', 'pt-BR'] as const

export type Locale = (typeof LOCALES)[number]

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
