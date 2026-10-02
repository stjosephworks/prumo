import { EntityManager, LockMode } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import { Session } from '@/domain/auth/entities/session.entity'
import type { SessionRepository } from '@/domain/auth/repositories/session.repository'

@injectable()
export class MikroOrmSessionRepository implements SessionRepository {
  constructor(private readonly em: EntityManager) {}

  findById(id: string): Promise<Session | null> {
    return this.em.findOne(Session, { id })
  }

  lockById(id: string): Promise<Session | null> {
    return this.em.findOne(Session, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
  }

  async save(session: Session): Promise<void> {
    await this.em.persist(session).flush()
  }
}
