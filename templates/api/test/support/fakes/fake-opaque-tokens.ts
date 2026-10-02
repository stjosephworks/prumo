import type { OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'

export class FakeOpaqueTokens implements OpaqueTokens {
  private next = 0

  create(): string {
    this.next += 1
    return `secret-${this.next}`
  }

  digest(token: string): string {
    return `digest:${token}`
  }
}
