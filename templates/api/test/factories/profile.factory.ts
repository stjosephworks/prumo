import type { EntityManager } from '@mikro-orm/postgresql'
import { type Locale, Profile } from '@/domain/users/entities/profile.entity'
import { createUser } from './user.factory'

type ProfileOverrides = Partial<{
  userId: string
  displayName: string
  locale: Locale
  timezone: string
}>

export async function createProfile(
  em: EntityManager,
  overrides: ProfileOverrides = {},
): Promise<Profile> {
  const profile = new Profile(
    overrides.userId ?? (await createUser(em)),
    overrides.displayName ?? 'Test Person',
  )

  profile.update({ locale: overrides.locale ?? 'en', timezone: overrides.timezone ?? 'UTC' })
  await em.persist(profile).flush()

  return profile
}
