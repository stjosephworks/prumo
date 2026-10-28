import { EntitySchema } from '@mikro-orm/core'
import { User } from '@/domain/auth/entities/user.entity'

export const UserSchema = new EntitySchema({
  class: User,
  // prumo:phone-code
  // An account is reached by one of them at least.
  checks: [
    { name: 'user_email_or_phone_check', expression: `"email" is not null or "phone" is not null` },
  ],
  // prumo:end-phone-code
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    email: {
      type: 'text',
      unique: true,
      nullable: true, // prumo:phone-code
    },
    // prumo:phone-code
    phone: { type: 'text', unique: true, nullable: true },
    phoneVerifiedAt: { type: 'datetime', nullable: true },
    // prumo:end-phone-code
    passwordHash: { type: 'text', nullable: true }, // prumo:password
    emailVerifiedAt: { type: 'datetime', nullable: true },
    createdAt: { type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' },
    updatedAt: {
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      defaultRaw: 'now()',
    },
  },
})
