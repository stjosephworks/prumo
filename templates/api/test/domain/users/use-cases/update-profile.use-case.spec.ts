import { InMemoryProfileRepository } from '@test/support/fakes/in-memory-profile.repository'
import { describe, expect, it } from 'vitest'
import { Profile } from '@/domain/users/entities/profile.entity'
import { ProfileNotFoundError } from '@/domain/users/errors/profile-not-found.error'
import { UpdateProfileUseCase } from '@/domain/users/use-cases/update-profile.use-case'

describe('UpdateProfileUseCase', () => {
  it('applies only the fields the request carries', async () => {
    const profiles = new InMemoryProfileRepository()
    const profile = new Profile('user-1', 'Ana')
    profile.update({ timezone: 'UTC' })
    await profiles.save(profile)

    const updated = await new UpdateProfileUseCase(profiles).execute('user-1', {
      timezone: 'America/Sao_Paulo',
    })

    expect(updated).toMatchObject({ displayName: 'Ana', timezone: 'America/Sao_Paulo' })
  })

  it('refuses a user without a profile', async () => {
    const updateProfile = new UpdateProfileUseCase(new InMemoryProfileRepository())

    await expect(updateProfile.execute('nobody', {})).rejects.toBeInstanceOf(ProfileNotFoundError)
  })
})
