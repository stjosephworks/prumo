import { EntitySchema } from '@mikro-orm/core'

// Better Auth owns auth.user. This maps only its id, so a foreign key into it is declared rather than
// hand-written; schema diffing skips the table, and nothing reads or writes it through the ORM.
export class AuthUser {
  id: string
}

export const AuthUserSchema = new EntitySchema({
  class: AuthUser,
  schema: 'auth',
  tableName: 'user',
  properties: {
    id: { type: 'uuid', primary: true },
  },
})
