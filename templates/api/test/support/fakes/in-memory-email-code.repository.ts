import type { EmailCode, EmailCodePurpose } from '@/domain/auth/entities/email-code.entity'
import type { EmailCodeRepository } from '@/domain/auth/repositories/email-code.repository'

export class InMemoryEmailCodeRepository implements EmailCodeRepository {
  readonly rows = new Map<string, EmailCode>()

  async lockFor(userId: string, purpose: EmailCodePurpose): Promise<EmailCode | null> {
    return this.rows.get(`${userId}:${purpose}`) ?? null
  }

  async save(code: EmailCode): Promise<void> {
    code.id ??= crypto.randomUUID()
    this.rows.set(`${code.userId}:${code.purpose}`, code)
  }
}
