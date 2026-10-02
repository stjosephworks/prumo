import { EntitySchema } from '@mikro-orm/core'
import { User } from '@/domain/auth/entities/user.entity'

export const UserSchema = new EntitySchema({
  class: User,
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    email: { type: 'text', unique: true },
    passwordHash: { type: 'text' },
    createdAt: { type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' },
    updatedAt: {
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      defaultRaw: 'now()',
    },
  },
})
