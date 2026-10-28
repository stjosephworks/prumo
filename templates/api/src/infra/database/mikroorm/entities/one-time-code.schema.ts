import { EntitySchema } from '@mikro-orm/core'
import { OneTimeCode } from '@/domain/auth/entities/one-time-code.entity'

export const OneTimeCodeSchema = new EntitySchema({
  class: OneTimeCode,
  uniques: [{ properties: ['channel', 'destination', 'purpose'] }],
  // The sweep finds dead codes by their expiry.
  indexes: [{ properties: ['expiresAt'] }],
  checks: [
    { name: 'one_time_code_channel_check', expression: `"channel" in ('email', 'phone')` },
    {
      name: 'one_time_code_purpose_check',
      expression: `"purpose" in ('verify-email', 'reset-password', 'sign-in')`,
    },
  ],
  properties: {
    id: { type: 'uuid', primary: true, defaultRaw: 'uuidv7()' },
    channel: { type: 'text' },
    destination: { type: 'text' },
    purpose: { type: 'text' },
    codeHash: { type: 'text' },
    attemptsLeft: { type: 'integer' },
    expiresAt: { type: 'datetime' },
    lastSentAt: { type: 'datetime' },
    hourStartedAt: { type: 'datetime' },
    sentThisHour: { type: 'integer' },
    dayStartedAt: { type: 'datetime' },
    sentToday: { type: 'integer' },
    createdAt: { type: 'datetime', onCreate: () => new Date(), defaultRaw: 'now()' },
    updatedAt: {
      type: 'datetime',
      onCreate: () => new Date(),
      onUpdate: () => new Date(),
      defaultRaw: 'now()',
    },
  },
})
