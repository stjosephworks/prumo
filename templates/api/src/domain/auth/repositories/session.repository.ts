import type { Session } from '@/domain/auth/entities/session.entity'

export interface SessionRepository {
  findById(id: string): Promise<Session | null>
  // Reads the row and holds it until the surrounding transaction ends, so two rotations cannot interleave.
  lockById(id: string): Promise<Session | null>
  save(session: Session): Promise<void>
  // Every session of the user, at once: a new password ends whatever the old one opened.
  revokeAllFor(userId: string, now: Date): Promise<void>
}

export const SESSION_REPOSITORY = Symbol('SessionRepository')
