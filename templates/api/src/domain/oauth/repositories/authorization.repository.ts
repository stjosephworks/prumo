import type { Authorization } from '@/domain/oauth/entities/authorization.entity'

export interface AuthorizationRepository {
  findById(id: string): Promise<Authorization | null>
  // Reads the row and holds it until the surrounding transaction ends, so a code is spent once.
  lockById(id: string): Promise<Authorization | null>
  save(authorization: Authorization): Promise<void>
}

export const AUTHORIZATION_REPOSITORY = Symbol('AuthorizationRepository')
