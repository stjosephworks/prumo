import { testOrm } from '@test/support/setup'
import { describe, expect, it } from 'vitest'
import { User } from '@/domain/auth/entities/user.entity'
import { EmailTakenError } from '@/domain/auth/errors/email-taken.error'
import { MikroOrmUserRepository } from '@/infra/database/mikroorm/repositories/mikroorm-user.repository'

describe('MikroOrmUserRepository', () => {
  it('finds a user by its normalized email', async () => {
    const repository = new MikroOrmUserRepository(testOrm().em.fork())
    const user = new User('Ana@Example.com', 'hash')

    await repository.save(user)

    expect(
      await new MikroOrmUserRepository(testOrm().em.fork()).findByEmail('ana@example.com'),
    ).toMatchObject({
      id: user.id,
    })
  })

  it('turns the unique index into EmailTakenError when two sign-ups race', async () => {
    await new MikroOrmUserRepository(testOrm().em.fork()).save(new User('ana@example.com', 'hash'))

    await expect(
      new MikroOrmUserRepository(testOrm().em.fork()).save(new User('ana@example.com', 'hash')),
    ).rejects.toBeInstanceOf(EmailTakenError)
  })
})
