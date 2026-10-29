import { inject, injectable } from 'tsyringe'
import { ReauthenticationRequiredError } from '@/domain/auth/errors/reauthentication-required.error'
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/domain/auth/repositories/session.repository'

@injectable()
export class RequireRecentSignInUseCase {
  constructor(@inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository) {}

  async execute(sessionId: string): Promise<void> {
    const session = await this.sessions.findById(sessionId)

    if (session === null || !session.isRecentSignIn(new Date())) {
      throw new ReauthenticationRequiredError()
    }
  }
}
