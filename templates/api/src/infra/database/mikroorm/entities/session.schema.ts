import { EntitySchema } from '@mikro-orm/core'
import { Session } from '@/domain/auth/entities/session.entity'

export const SessionSchema = new EntitySchema({
  class: Session,
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    userId: {
      kind: 'm:1',
      // EntitySchema cannot type a to-one relation held as its primary key on a string property.
      entity: () => 'User' as never,
      mapToPk: true,
      fieldName: 'user_id',
      index: true,
      // A session means nothing without its user.
      deleteRule: 'cascade',
    },
    tokenHash: { type: 'text' },
    previousTokenHash: { type: 'text', nullable: true },
    rotatedAt: { type: 'datetime', nullable: true },
    expiresAt: { type: 'datetime' },
    revokedAt: { type: 'datetime', nullable: true },
    createdAt: { type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' },
    updatedAt: {
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      defaultRaw: 'now()',
    },
  },
})
