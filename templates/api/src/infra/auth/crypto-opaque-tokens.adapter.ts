import { createHash, randomBytes } from 'node:crypto'
import type { OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'

// 256 random bits need no slow hash: nothing can be guessed, so a plain SHA-256 is enough to keep a stolen
// database from handing out working tokens.
export class CryptoOpaqueTokens implements OpaqueTokens {
  create(): string {
    return randomBytes(32).toString('base64url')
  }

  digest(token: string): string {
    return createHash('sha256').update(token).digest('base64url')
  }
}
