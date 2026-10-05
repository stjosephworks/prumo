import type { EmailCode, EmailCodePurpose } from '@/domain/auth/entities/email-code.entity'

export interface EmailCodeRepository {
  // Reads the row and holds it until the surrounding transaction ends, so two guesses cannot both spend one attempt.
  lockFor(userId: string, purpose: EmailCodePurpose): Promise<EmailCode | null>
  save(code: EmailCode): Promise<void>
}

export const EMAIL_CODE_REPOSITORY = Symbol('EmailCodeRepository')
