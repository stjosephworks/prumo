import { EntityManager } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import { Profile } from '@/domain/users/entities/profile.entity'
import type { ProfileRepository } from '@/domain/users/repositories/profile.repository'

@injectable()
export class MikroOrmProfileRepository implements ProfileRepository {
  constructor(private readonly em: EntityManager) {}

  findByUserId(userId: string): Promise<Profile | null> {
    return this.em.findOne(Profile, { userId })
  }

  async save(profile: Profile): Promise<void> {
    await this.em.persist(profile).flush()
  }
}
