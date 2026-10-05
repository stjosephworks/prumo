import type { Identity } from '@/domain/auth/entities/identity.entity'
import type { ProviderName } from '@/domain/auth/ports/identity-providers.port'

export interface IdentityRepository {
  findBySubject(provider: ProviderName, subject: string): Promise<Identity | null>
  save(identity: Identity): Promise<void>
}

export const IDENTITY_REPOSITORY = Symbol('IdentityRepository')
