import { inject, injectable } from 'tsyringe'
import { Identity } from '@/domain/auth/entities/identity.entity'
import { User } from '@/domain/auth/entities/user.entity'
import { ProviderEmailUnverifiedError } from '@/domain/auth/errors/provider-email-unverified.error'
import type { ProviderName, ProviderProfile } from '@/domain/auth/ports/identity-providers.port'
import {
  IDENTITY_REPOSITORY,
  type IdentityRepository,
} from '@/domain/auth/repositories/identity.repository'
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '@/domain/auth/repositories/session.repository'
import { USER_REPOSITORY, type UserRepository } from '@/domain/auth/repositories/user.repository'
import {
  TRANSACTION_MANAGER,
  type TransactionManager,
} from '@/domain/shared/transactions/transaction-manager'
import { CreateProfileUseCase } from '@/domain/users/use-cases/create-profile.use-case'

const DISPLAY_NAME_MAX = 80

@injectable()
export class LinkIdentityUseCase {
  constructor(
    @inject(USER_REPOSITORY) private readonly users: UserRepository,
    @inject(IDENTITY_REPOSITORY) private readonly identities: IdentityRepository,
    @inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @inject(TRANSACTION_MANAGER) private readonly transactions: TransactionManager,
    private readonly createProfile: CreateProfileUseCase,
  ) {}

  // Returns the id of the user the provider's account belongs to, creating or linking it as the rules say.
  execute(provider: ProviderName, profile: ProviderProfile): Promise<string> {
    return this.transactions.run(async () => {
      const known = await this.identities.findBySubject(provider, profile.subject)

      if (known !== null) {
        return known.userId
      }

      if (!profile.emailVerified) {
        throw new ProviderEmailUnverifiedError()
      }

      const now = new Date()
      const existing = await this.users.findByEmail(User.normalizeEmail(profile.email))

      if (existing !== null) {
        // Nobody had shown this inbox was theirs, and the provider just did: whoever chose the password, possibly
        // to wait for the real owner, loses it and every session it opened.
        if (existing.emailVerifiedAt === null) {
          existing.removePassword()
          existing.verifyEmail(now)
          await this.users.save(existing)
          await this.sessions.revokeAllFor(existing.id, now)
        }

        await this.identities.save(new Identity(existing.id, provider, profile.subject))

        return existing.id
      }

      const user = new User(profile.email, null)

      user.verifyEmail(now)
      await this.users.save(user)
      await this.createProfile.execute(
        user.id,
        (profile.name ?? profile.email.split('@')[0] ?? profile.email).slice(0, DISPLAY_NAME_MAX),
      )
      await this.identities.save(new Identity(user.id, provider, profile.subject))

      return user.id
    })
  }
}
