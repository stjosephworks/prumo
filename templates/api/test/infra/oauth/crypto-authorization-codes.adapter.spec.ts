import { describe, expect, it } from 'vitest'
import { CryptoAuthorizationCodes } from '@/infra/oauth/crypto-authorization-codes.adapter'

describe('CryptoAuthorizationCodes', () => {
  // The example in RFC 7636, Appendix B.
  it('matches the RFC’s own S256 example, and nothing else', () => {
    const codes = new CryptoAuthorizationCodes()
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'

    expect(codes.matchesChallenge(verifier, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(
      true,
    )
    expect(codes.matchesChallenge(verifier, verifier)).toBe(false)
    expect(
      codes.matchesChallenge(`${verifier}x`, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'),
    ).toBe(false)
  })
})
