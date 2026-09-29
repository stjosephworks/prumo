import { describe, expect, it } from 'vitest'
import { InMemoryProfileRepository } from '../../../../test/fakes/in-memory-profile.repository'
import { Profile } from '../entities/profile.entity'
import { ProfileNotFoundError } from '../errors/profile-not-found.error'
import { FindProfileUseCase } from './find-profile.use-case'

describe('FindProfileUseCase', () => {
  it('finds the profile belonging to a user', async () => {
    const profiles = new InMemoryProfileRepository()
    await profiles.save(new Profile('user-1', 'Ana'))

    await expect(new FindProfileUseCase(profiles).execute('user-1')).resolves.toMatchObject({
      displayName: 'Ana',
    })
  })

  it('refuses a user without a profile', async () => {
    const findProfile = new FindProfileUseCase(new InMemoryProfileRepository())

    await expect(findProfile.execute('nobody')).rejects.toBeInstanceOf(ProfileNotFoundError)
  })
})
