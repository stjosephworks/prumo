import type { EntityManager } from '@mikro-orm/postgresql'
import { createUser } from '@test/support/factories/user.factory'
import { Profile } from '@/domain/users/entities/profile.entity'
import { BASE_LOCALE, type Locale } from '@/i18n/locales'

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

  profile.update({ locale: overrides.locale ?? BASE_LOCALE, timezone: overrides.timezone ?? 'UTC' })
  await em.persist(profile).flush()

  return profile
}
