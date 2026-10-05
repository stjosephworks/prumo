import type { OneTimeCodes } from '@/domain/auth/ports/one-time-codes.port'

export class FakeOneTimeCodes implements OneTimeCodes {
  private next = 100000

  create(): string {
    this.next += 1
    return String(this.next)
  }

  digest(code: string): string {
    return `digest:${code}`
  }
}
