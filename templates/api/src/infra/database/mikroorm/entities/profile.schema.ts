import { EntitySchema } from '@mikro-orm/core'
import { Profile } from '@/domain/users/entities/profile.entity'

export const ProfileSchema = new EntitySchema({
  class: Profile,
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    userId: {
      kind: 'm:1',
      // EntitySchema cannot type a to-one relation held as its primary key on a string property.
      entity: () => 'User' as never,
      mapToPk: true,
      fieldName: 'user_id',
      unique: true,
      deleteRule: 'restrict',
    },
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
