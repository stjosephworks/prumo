import { EntityManager, LockMode } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import { EmailCode, type EmailCodePurpose } from '@/domain/auth/entities/email-code.entity'
import type { EmailCodeRepository } from '@/domain/auth/repositories/email-code.repository'

@injectable()
export class MikroOrmEmailCodeRepository implements EmailCodeRepository {
  constructor(private readonly em: EntityManager) {}

  lockFor(userId: string, purpose: EmailCodePurpose): Promise<EmailCode | null> {
    return this.em.findOne(EmailCode, { userId, purpose }, { lockMode: LockMode.PESSIMISTIC_WRITE })
  }

  async save(code: EmailCode): Promise<void> {
    await this.em.persist(code).flush()
  }
}
