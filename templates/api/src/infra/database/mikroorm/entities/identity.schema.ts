import { EntitySchema } from '@mikro-orm/core'
import { Identity } from '@/domain/auth/entities/identity.entity'

export const IdentitySchema = new EntitySchema({
  class: Identity,
  uniques: [{ properties: ['provider', 'subject'] }],
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    userId: {
      kind: 'm:1',
      // EntitySchema cannot type a to-one relation held as its primary key on a string property.
      entity: () => 'User' as never,
      mapToPk: true,
      fieldName: 'user_id',
      index: true,
      // An identity means nothing without its user.
      deleteRule: 'cascade',
    },
    provider: { type: 'text' },
    subject: { type: 'text' },
    createdAt: { type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' },
    updatedAt: {
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      defaultRaw: 'now()',
    },
  },
})
