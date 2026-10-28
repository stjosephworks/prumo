import { testOrm } from '@test/support/setup'
import { describe, expect, it } from 'vitest'
import { OneTimeCode } from '@/domain/auth/entities/one-time-code.entity'
import { MikroOrmOneTimeCodeRepository } from '@/infra/database/mikroorm/repositories/mikroorm-one-time-code.repository'

const DAY_MS = 24 * 60 * 60 * 1000

function repository() {
  return new MikroOrmOneTimeCodeRepository(testOrm().em.fork())
}

async function sent(destination: string, at: Date): Promise<void> {
  await repository().save(new OneTimeCode('email', destination, 'reset-password', 'hash', at))
}

describe('MikroOrmOneTimeCodeRepository', () => {
  it('finds a code by its channel, destination and purpose', async () => {
    await sent('ana@example.com', new Date())

    // The lock holds until the transaction ends, so it needs one.
    const [found, otherPurpose] = await testOrm()
      .em.fork()
      .transactional(async (em) => {
        const codes = new MikroOrmOneTimeCodeRepository(em)

        return Promise.all([
          codes.lockFor('email', 'ana@example.com', 'reset-password'),
          codes.lockFor('email', 'ana@example.com', 'verify-email'),
        ])
      })

    expect(found).toBeInstanceOf(OneTimeCode)
    expect(found).toMatchObject({ codeHash: 'hash', sentThisHour: 1, sentToday: 1 })
    expect(otherPurpose).toBeNull()
  })

  it('sweeps codes that are dead and past their day, and keeps the rest', async () => {
    const now = new Date()
    await sent('old@example.com', new Date(now.getTime() - DAY_MS - 1))
    await sent('today@example.com', new Date(now.getTime() - DAY_MS / 2))
    await sent('live@example.com', now)

    await repository().sweep(now, 100)

    const left = await testOrm()
      .em.fork()
      .find(OneTimeCode, {}, { orderBy: { destination: 'asc' } })

    expect(left.map((code) => code.destination)).toEqual(['live@example.com', 'today@example.com'])
  })

  it('sweeps no more than it is told to', async () => {
    const old = new Date(Date.now() - DAY_MS - 1)
    await sent('one@example.com', old)
    await sent('two@example.com', old)

    await repository().sweep(new Date(), 1)

    await expect(testOrm().em.fork().count(OneTimeCode)).resolves.toBe(1)
  })
})
