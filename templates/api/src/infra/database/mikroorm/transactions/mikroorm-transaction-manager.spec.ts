import { RequestContext } from '@mikro-orm/postgresql'
import { describe, expect, it } from 'vitest'
import { Profile } from '@/domain/users/entities/profile.entity'
import { createUser } from '../../../../../test/factories/user.factory'
import { testOrm } from '../../../../../test/setup'
import { MikroOrmProfileRepository } from '../repositories/mikroorm-profile.repository'
import { MikroOrmTransactionManager } from './mikroorm-transaction-manager'

describe('MikroOrmTransactionManager', () => {
  it('rolls back every write inside run() when one of them fails', async () => {
    const orm = testOrm()
    const userId = await createUser(orm.em.fork())

    // The same wiring as a request: the global EntityManager, resolved through a request context.
    await RequestContext.create(orm.em, async () => {
      const transactions = new MikroOrmTransactionManager(orm.em)
      const profiles = new MikroOrmProfileRepository(orm.em)

      await expect(
        transactions.run(async () => {
          await profiles.save(new Profile(userId, 'first'))
          await profiles.save(new Profile(userId, 'same user, refused by the unique constraint'))
        }),
      ).rejects.toThrow()
    })

    expect(await orm.em.fork().count(Profile)).toBe(0)
  })
})
