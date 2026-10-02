import type { Session } from '@/domain/auth/entities/session.entity'
import type { SessionRepository } from '@/domain/auth/repositories/session.repository'

export class InMemorySessionRepository implements SessionRepository {
  readonly rows = new Map<string, Session>()

  async findById(id: string): Promise<Session | null> {
    return this.rows.get(id) ?? null
  }

  lockById(id: string): Promise<Session | null> {
    return this.findById(id)
  }

  async save(session: Session): Promise<void> {
    session.id ??= crypto.randomUUID()
    this.rows.set(session.id, session)
  }
}
