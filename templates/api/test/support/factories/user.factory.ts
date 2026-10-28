import type { EntityManager } from '@mikro-orm/postgresql'
import { User } from '@/domain/auth/entities/user.entity'

type UserOverrides = Partial<{ email: string }>

// A user with no way to sign in: a test that signs in goes through the routes instead.
export async function createUser(
  em: EntityManager,
  overrides: UserOverrides = {},
): Promise<string> {
  const user = new User({ email: overrides.email ?? `${crypto.randomUUID()}@example.com` })

  await em.persist(user).flush()

  return user.id
}
