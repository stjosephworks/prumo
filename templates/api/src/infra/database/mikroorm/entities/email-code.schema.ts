import { EntitySchema } from '@mikro-orm/core'
import { EmailCode } from '@/domain/auth/entities/email-code.entity'

export const EmailCodeSchema = new EntitySchema({
  class: EmailCode,
  uniques: [{ properties: ['userId', 'purpose'] }],
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    userId: {
      kind: 'm:1',
      // EntitySchema cannot type a to-one relation held as its primary key on a string property.
      entity: () => 'User' as never,
      mapToPk: true,
      fieldName: 'user_id',
      // A code means nothing without its user.
      deleteRule: 'cascade',
    },
    purpose: { type: 'text' },
    codeHash: { type: 'text' },
    attemptsLeft: { type: 'integer' },
    expiresAt: { type: 'datetime' },
    createdAt: { type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' },
    updatedAt: {
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      defaultRaw: 'now()',
    },
  },
})
