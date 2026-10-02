import { inject, injectable } from 'tsyringe'
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/domain/auth/repositories/session.repository'

@injectable()
export class SignOutUseCase {
  constructor(@inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository) {}

  // Signing out twice, or out of a session already gone, is not an error: the outcome is the same.
  async execute(userId: string, sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId)

    if (session === null || session.userId !== userId) {
      return
    }

    session.revoke(new Date())
    await this.sessions.save(session)
  }
}
