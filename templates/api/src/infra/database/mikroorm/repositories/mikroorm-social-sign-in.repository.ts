import { EntityManager, LockMode } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import type { SocialSignInRepository } from '@/domain/auth/repositories/social-sign-in.repository'

@injectable()
export class MikroOrmSocialSignInRepository implements SocialSignInRepository {
  constructor(private readonly em: EntityManager) {}

  lockById(id: string): Promise<SocialSignIn | null> {
    return this.em.findOne(SocialSignIn, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
  }

  async save(signIn: SocialSignIn): Promise<void> {
    await this.em.persist(signIn).flush()
  }
}
