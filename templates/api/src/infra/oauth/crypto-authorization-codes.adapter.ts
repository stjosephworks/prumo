import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { AuthorizationCodes } from '@/domain/oauth/ports/authorization-codes.port'

const sha256 = (value: string) => createHash('sha256').update(value).digest('base64url')

export class CryptoAuthorizationCodes implements AuthorizationCodes {
  create(): string {
    return randomBytes(32).toString('base64url')
  }

  digest(code: string): string {
    return sha256(code)
  }

  matchesChallenge(verifier: string, challenge: string): boolean {
    const expected = Buffer.from(sha256(verifier))
    const given = Buffer.from(challenge)

    return expected.length === given.length && timingSafeEqual(expected, given)
  }
}
