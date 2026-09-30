import { randomUUID } from 'node:crypto'
import type { EntityManager } from '@mikro-orm/postgresql'

type UserOverrides = Partial<{ name: string; email: string }>

export async function createUser(
  em: EntityManager,
  overrides: UserOverrides = {},
): Promise<string> {
  const id = randomUUID()

  // auth.user belongs to Better Auth, and the ORM maps only its id, so the row is written in SQL.
  await em
    .getConnection()
    .execute(
      'insert into auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt") values (?, ?, ?, false, now(), now())',
      [id, overrides.name ?? 'Test Person', overrides.email ?? `${id}@example.com`],
    )

  return id
}
