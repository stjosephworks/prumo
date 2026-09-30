import type { EntityManager } from '@mikro-orm/postgresql'
import { createUser } from '@test/support/factories/user.factory'
import { type Locale, Profile } from '@/domain/users/entities/profile.entity'

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
