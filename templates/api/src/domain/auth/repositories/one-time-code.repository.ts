import type {
  CodeChannel,
  CodePurpose,
  OneTimeCode,
} from '@/domain/auth/entities/one-time-code.entity'

export interface OneTimeCodeRepository {
  // Reads the row and holds it until the surrounding transaction ends, so two guesses cannot both spend one attempt.
  lockFor(
    channel: CodeChannel,
    destination: string,
    purpose: CodePurpose,
  ): Promise<OneTimeCode | null>
  save(code: OneTimeCode): Promise<void>
  // Deletes at most `limit` rows whose code is dead and whose daily limit is over, so nothing is kept about an
  // address longer than the limits need it.
  sweep(now: Date, limit: number): Promise<void>
}

export const ONE_TIME_CODE_REPOSITORY = Symbol('OneTimeCodeRepository')
