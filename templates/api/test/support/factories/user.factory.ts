import type { EntityManager } from '@mikro-orm/postgresql'
import { User } from '@/domain/auth/entities/user.entity'

type UserOverrides = Partial<{ email: string; passwordHash: string }>

// The hash is not a real one: a test that signs in goes through the sign-up route instead.
export async function createUser(
  em: EntityManager,
  overrides: UserOverrides = {},
): Promise<string> {
  const user = new User(
    overrides.email ?? `${crypto.randomUUID()}@example.com`,
    overrides.passwordHash ?? 'not-a-real-hash',
  )

  await em.persist(user).flush()

  return user.id
}
