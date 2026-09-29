import type { DependencyContainer } from 'tsyringe'
import { PROFILE_REPOSITORY } from '@/domain/users/repositories/profile.repository'
import { MikroOrmProfileRepository } from '@/infra/database/mikroorm/repositories/mikroorm-profile.repository'

export function registerUsers(container: DependencyContainer): void {
  container.register(PROFILE_REPOSITORY, { useClass: MikroOrmProfileRepository })
}
