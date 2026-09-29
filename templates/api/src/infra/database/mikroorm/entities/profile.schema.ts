import { EntitySchema } from '@mikro-orm/core'
import { Profile } from '@/domain/users/entities/profile.entity'

export const ProfileSchema = new EntitySchema({
  class: Profile,
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    userId: { type: 'uuid', unique: true },
    displayName: { type: 'text' },
    locale: { type: 'text', default: 'en' },
    timezone: { type: 'text', default: 'UTC' },
    createdAt: { type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' },
    updatedAt: {
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      defaultRaw: 'now()',
    },
  },
})
