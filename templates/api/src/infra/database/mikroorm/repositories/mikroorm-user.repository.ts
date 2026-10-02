import { EntityManager, UniqueConstraintViolationException } from '@mikro-orm/postgresql'
import { injectable } from 'tsyringe'
import { User } from '@/domain/auth/entities/user.entity'
import { EmailTakenError } from '@/domain/auth/errors/email-taken.error'
import type { UserRepository } from '@/domain/auth/repositories/user.repository'

@injectable()
export class MikroOrmUserRepository implements UserRepository {
  constructor(private readonly em: EntityManager) {}

  findById(id: string): Promise<User | null> {
    return this.em.findOne(User, { id })
  }

  findByEmail(email: string): Promise<User | null> {
    return this.em.findOne(User, { email })
  }

  async save(user: User): Promise<void> {
    try {
      await this.em.persist(user).flush()
    } catch (error) {
      // Two sign-ups with one email can both pass the check; the unique index settles which one exists.
      if (error instanceof UniqueConstraintViolationException) {
        throw new EmailTakenError()
      }

      throw error
    }
  }
}
