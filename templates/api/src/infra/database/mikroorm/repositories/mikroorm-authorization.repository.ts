import { EntityManager, LockMode } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import { Authorization } from '@/domain/oauth/entities/authorization.entity'
import type { AuthorizationRepository } from '@/domain/oauth/repositories/authorization.repository'

@injectable()
export class MikroOrmAuthorizationRepository implements AuthorizationRepository {
  constructor(private readonly em: EntityManager) {}

  findById(id: string): Promise<Authorization | null> {
    return this.em.findOne(Authorization, { id })
  }

  lockById(id: string): Promise<Authorization | null> {
    return this.em.findOne(Authorization, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
  }

  async save(authorization: Authorization): Promise<void> {
    await this.em.persist(authorization).flush()
  }
}
