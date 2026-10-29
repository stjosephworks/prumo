import { inject, injectable } from 'tsyringe'
import { type SocialClient, SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import { OPAQUE_TOKENS, type OpaqueTokens } from '@/domain/auth/ports/opaque-tokens.port'
import {
  SOCIAL_SIGN_IN_REPOSITORY,
  type SocialSignInRepository,
} from '@/domain/auth/repositories/social-sign-in.repository'

@injectable()
export class StartAccountDeletionUseCase {
  constructor(
    @inject(SOCIAL_SIGN_IN_REPOSITORY) private readonly signIns: SocialSignInRepository,
    @inject(OPAQUE_TOKENS) private readonly opaque: OpaqueTokens,
  ) {}

  // A ticket the client opens in a browser, which goes to Apple from there. No session travels with a browser opened
  // by an app, so the trip is bound to the account here, while the session is at hand.
  async execute({ userId, client }: { userId: string; client: SocialClient }): Promise<string> {
    const secret = this.opaque.create()
    const signIn = new SocialSignIn('apple', client, '/', this.opaque.digest(secret), new Date())

    signIn.forDeletion(userId)
    await this.signIns.save(signIn)

    return signIn.token(secret)
  }
}
