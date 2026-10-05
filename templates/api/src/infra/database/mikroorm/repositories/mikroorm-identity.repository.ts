import { EntityManager } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import { Identity } from '@/domain/auth/entities/identity.entity'
import type { ProviderName } from '@/domain/auth/ports/identity-providers.port'
import type { IdentityRepository } from '@/domain/auth/repositories/identity.repository'

@injectable()
export class MikroOrmIdentityRepository implements IdentityRepository {
  constructor(private readonly em: EntityManager) {}

  findBySubject(provider: ProviderName, subject: string): Promise<Identity | null> {
    return this.em.findOne(Identity, { provider, subject })
  }

  async save(identity: Identity): Promise<void> {
    await this.em.persist(identity).flush()
  }
}
