import {
  type CodeChannel,
  type CodePurpose,
  type OneTimeCode,
  staleBefore,
} from '@/domain/auth/entities/one-time-code.entity'
import type { OneTimeCodeRepository } from '@/domain/auth/repositories/one-time-code.repository'

export class InMemoryOneTimeCodeRepository implements OneTimeCodeRepository {
  readonly rows = new Map<string, OneTimeCode>()

  async lockFor(
    channel: CodeChannel,
    destination: string,
    purpose: CodePurpose,
  ): Promise<OneTimeCode | null> {
    return this.rows.get(`${channel}:${destination}:${purpose}`) ?? null
  }

  async save(code: OneTimeCode): Promise<void> {
    code.id ??= crypto.randomUUID()
    this.rows.set(`${code.channel}:${code.destination}:${code.purpose}`, code)
  }

  async sweep(now: Date, limit: number): Promise<void> {
    const stale = [...this.rows].filter(
      ([, code]) => code.expiresAt < now && code.dayStartedAt < staleBefore(now),
    )

    for (const [key] of stale.slice(0, limit)) {
      this.rows.delete(key)
    }
  }
}
