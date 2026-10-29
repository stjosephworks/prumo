import { testOrm } from '@test/support/setup'
import { describe, expect, it } from 'vitest'
import { User } from '@/domain/auth/entities/user.entity'
import { EmailTakenError } from '@/domain/auth/errors/email-taken.error'
import { MikroOrmUserRepository } from '@/infra/database/mikroorm/repositories/mikroorm-user.repository'

describe('MikroOrmUserRepository', () => {
  it('finds a user by its normalized email', async () => {
    const repository = new MikroOrmUserRepository(testOrm().em.fork())
    const user = new User({ email: 'Ana@Example.com' })

    await repository.save(user)

    expect(
      await new MikroOrmUserRepository(testOrm().em.fork()).findByEmail('ana@example.com'),
    ).toMatchObject({
      id: user.id,
    })
  })

  it('turns the unique index into EmailTakenError when two sign-ups race', async () => {
    await new MikroOrmUserRepository(testOrm().em.fork()).save(
      new User({ email: 'ana@example.com' }),
    )

    await expect(
      new MikroOrmUserRepository(testOrm().em.fork()).save(new User({ email: 'ana@example.com' })),
    ).rejects.toBeInstanceOf(EmailTakenError)
  })

  // prumo:phone-code
  it('finds a user by phone, and keeps one created by a phone without an email', async () => {
    const user = new User({ phone: '+14155552671' })

    await new MikroOrmUserRepository(testOrm().em.fork()).save(user)

    expect(
      await new MikroOrmUserRepository(testOrm().em.fork()).findByPhone('+14155552671'),
    ).toMatchObject({ id: user.id, email: null })
  })
  // prumo:end-phone-code
})
