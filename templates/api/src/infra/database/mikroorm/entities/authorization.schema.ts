import { EntitySchema } from '@mikro-orm/core'
import { Authorization } from '@/domain/oauth/entities/authorization.entity'

export const AuthorizationSchema = new EntitySchema({
  class: Authorization,
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    clientId: { type: 'text' },
    clientName: { type: 'text' },
    redirectUri: { type: 'text' },
    codeChallenge: { type: 'text' },
    clientState: { type: 'text', nullable: true },
    resource: { type: 'text' },
    scope: { type: 'text' },
    status: { type: 'text' },
    userId: {
      kind: 'm:1',
      // EntitySchema cannot type a to-one relation held as its primary key on a string property.
      entity: () => 'User' as never,
      mapToPk: true,
      fieldName: 'user_id',
      nullable: true,
      index: true,
      // An authorization means nothing without the user who gave it.
      deleteRule: 'cascade',
    },
    codeHash: { type: 'text', nullable: true },
    sessionId: { type: 'uuid', nullable: true },
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
