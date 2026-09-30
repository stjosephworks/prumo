import { createProfile } from '@test/support/factories/profile.factory'
import { createUser } from '@test/support/factories/user.factory'
import { testOrm } from '@test/support/setup'
import { describe, expect, it } from 'vitest'
import { Profile } from '@/domain/users/entities/profile.entity'
import { MikroOrmProfileRepository } from '@/infra/database/mikroorm/repositories/mikroorm-profile.repository'

describe('MikroOrmProfileRepository', () => {
  it('finds a profile by its user', async () => {
    const created = await createProfile(testOrm().em.fork(), { displayName: 'Ana' })
    const profiles = new MikroOrmProfileRepository(testOrm().em.fork())

    const found = await profiles.findByUserId(created.userId)

    expect(found).toBeInstanceOf(Profile)
    expect(found).toMatchObject({ displayName: 'Ana' })
  })

  it('answers null for a user without a profile', async () => {
    const profiles = new MikroOrmProfileRepository(testOrm().em.fork())

    await expect(profiles.findByUserId(crypto.randomUUID())).resolves.toBeNull()
  })

  it('lets the database fill the id, the defaults and the timestamps', async () => {
    const userId = await createUser(testOrm().em.fork())
    await new MikroOrmProfileRepository(testOrm().em.fork()).save(new Profile(userId, 'Ana'))

    const stored = await new MikroOrmProfileRepository(testOrm().em.fork()).findByUserId(userId)

    expect(stored).toMatchObject({ locale: 'en', timezone: 'UTC' })
    // uuidv7() puts the version nibble at the start of the third group.
    expect(stored?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
    expect(stored?.createdAt).toBeInstanceOf(Date)
  })

  it('writes what the entity changed', async () => {
    const created = await createProfile(testOrm().em.fork(), { timezone: 'UTC' })
    const profiles = new MikroOrmProfileRepository(testOrm().em.fork())
    const profile = await profiles.findByUserId(created.userId)

    profile?.update({ timezone: 'America/Sao_Paulo' })
    await profiles.save(profile as Profile)

    const reloaded = await new MikroOrmProfileRepository(testOrm().em.fork()).findByUserId(
      created.userId,
    )

    expect(reloaded?.timezone).toBe('America/Sao_Paulo')
  })
})
