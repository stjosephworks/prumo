import type { ReviewSignIns } from '@/domain/auth/ports/review-sign-ins.port'

// The pairs REVIEW_SIGN_IN names, by normalised destination: an email lowercased, a phone in E.164.
export class EnvReviewSignIns implements ReviewSignIns {
  constructor(
    private readonly codes: ReadonlyMap<string, string>,
    private readonly warn: (line: string) => void,
  ) {}

  accepts(destination: string, code: string): boolean {
    if (this.codes.get(destination) !== code) {
      return false
    }

    this.warn(`[review] ${destination} signed in with the code from REVIEW_SIGN_IN`)
    return true
  }
}
