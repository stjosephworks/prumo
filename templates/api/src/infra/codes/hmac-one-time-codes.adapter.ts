import { createHmac, randomInt } from 'node:crypto'
import type { OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'
import type { Env } from '@/infra/config/env'

export class HmacOneTimeCodes implements OneTimeCodes {
  constructor(private readonly env: Pick<Env, 'JWT_SECRET'>) {}

  create(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  // A million codes hash in a moment, so the hash is keyed by a secret the database does not hold.
  digest(code: string): string {
    return createHmac('sha256', this.env.JWT_SECRET).update(code).digest('base64url')
  }
}
