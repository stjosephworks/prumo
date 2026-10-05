import { EntitySchema } from '@mikro-orm/core'
import { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'

export const SocialSignInSchema = new EntitySchema({
  class: SocialSignIn,
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    provider: { type: 'text' },
    client: { type: 'text' },
    returnTo: { type: 'text' },
    browserHash: { type: 'text' },
    codeVerifier: { type: 'text', nullable: true },
    nonce: { type: 'text' },
    status: { type: 'text' },
    userId: {
      kind: 'm:1',
      // EntitySchema cannot type a to-one relation held as its primary key on a string property.
      entity: () => 'User' as never,
      mapToPk: true,
      fieldName: 'user_id',
      nullable: true,
      index: true,
      deleteRule: 'cascade',
    },
    exchangeHash: { type: 'text', nullable: true },
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
