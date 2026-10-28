import { authFakes, LIFETIME_MS } from '@test/support/fakes/auth-fakes'
import { FakeOpaqueTokens } from '@test/support/fakes/fake-opaque-tokens'
import { ImmediateTransactionManager } from '@test/support/fakes/immediate-transaction-manager'
import type { Identity } from '@/domain/auth/entities/identity.entity'
import type { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'
import type {
  IdentityProviders,
  ProviderCallback,
  ProviderName,
  ProviderProfile,
  ProviderRedirect,
} from '@/domain/auth/ports/identity-providers.port'
import type { IdentityRepository } from '@/domain/auth/repositories/identity.repository'
import type { SocialSignInRepository } from '@/domain/auth/repositories/social-sign-in.repository'
import { CompleteSocialSignInUseCase } from '@/domain/auth/use-cases/complete-social-sign-in.use-case'
import { DeleteAccountUseCase } from '@/domain/auth/use-cases/delete-account.use-case' // prumo:apple
import { ExchangeSocialCodeUseCase } from '@/domain/auth/use-cases/exchange-social-code.use-case'
import { LinkIdentityUseCase } from '@/domain/auth/use-cases/link-identity.use-case'
import { RequireRecentSignInUseCase } from '@/domain/auth/use-cases/require-recent-sign-in.use-case' // prumo:apple
import { ResumeAccountDeletionUseCase } from '@/domain/auth/use-cases/resume-account-deletion.use-case' // prumo:apple
import { StartAccountDeletionUseCase } from '@/domain/auth/use-cases/start-account-deletion.use-case' // prumo:apple
import { StartSessionUseCase } from '@/domain/auth/use-cases/start-session.use-case'
import { StartSocialSignInUseCase } from '@/domain/auth/use-cases/start-social-sign-in.use-case'
import { CreateProfileUseCase } from '@/domain/users/use-cases/create-profile.use-case'
import { DeleteProfileUseCase } from '@/domain/users/use-cases/delete-profile.use-case' // prumo:apple
import { FakeAccessTokens } from './fake-access-tokens'

export class InMemoryIdentityRepository implements IdentityRepository {
  readonly rows: Identity[] = []

  async findBySubject(provider: ProviderName, subject: string): Promise<Identity | null> {
    return this.rows.find((row) => row.provider === provider && row.subject === subject) ?? null
  }

  async findByUser(userId: string): Promise<Identity[]> {
    return this.rows.filter((row) => row.userId === userId)
  }

  async save(identity: Identity): Promise<void> {
    identity.id ??= crypto.randomUUID()
    this.rows.push(identity)
  }
}

export class InMemorySocialSignInRepository implements SocialSignInRepository {
  readonly rows = new Map<string, SocialSignIn>()

  async lockById(id: string): Promise<SocialSignIn | null> {
    return this.rows.get(id) ?? null
  }

  async save(signIn: SocialSignIn): Promise<void> {
    signIn.id ??= crypto.randomUUID()
    this.rows.set(signIn.id, signIn)
  }
}

// A provider that answers what the test tells it to, and remembers what it was asked.
export class FakeIdentityProviders implements IdentityProviders {
  next: ProviderProfile = {
    subject: 'google-sub-1',
    email: 'ana@example.com',
    emailVerified: true,
    name: 'Ana',
  }
  lastCallback: ProviderCallback | undefined
  readonly revoked: ProviderName[] = []

  constructor(private readonly configured: ProviderName[] = ['google', 'apple']) {}

  isConfigured(provider: ProviderName): boolean {
    return this.configured.includes(provider)
  }

  async redirect(provider: ProviderName, state: string): Promise<ProviderRedirect> {
    return {
      url: `https://${provider}.test/authorize?state=${state}`,
      codeVerifier: 'verifier',
      nonce: 'nonce',
    }
  }

  async profile(_provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile> {
    this.lastCallback = callback
    return this.next
  }

  async revoke(provider: ProviderName, callback: ProviderCallback): Promise<ProviderProfile> {
    this.revoked.push(provider)
    return this.profile(provider, callback)
  }
}

export function socialFakes() {
  const auth = authFakes()
  const identities = new InMemoryIdentityRepository()
  const signIns = new InMemorySocialSignInRepository()
  const providers = new FakeIdentityProviders()
  const opaque = new FakeOpaqueTokens()
  const transactions = new ImmediateTransactionManager()
  const startSession = new StartSessionUseCase(
    auth.sessions,
    new FakeAccessTokens(),
    opaque,
    LIFETIME_MS,
  )
  const linkIdentity = new LinkIdentityUseCase(
    auth.users,
    identities,
    auth.sessions,
    transactions,
    new CreateProfileUseCase(auth.profiles),
  )
  // prumo:apple
  const deleteAccount = new DeleteAccountUseCase(
    auth.users,
    transactions,
    new RequireRecentSignInUseCase(auth.sessions),
    new DeleteProfileUseCase(auth.profiles),
    identities,
    providers,
  )
  // prumo:end-apple

  return {
    ...auth,
    identities,
    signIns,
    providers,
    linkIdentity,
    start: new StartSocialSignInUseCase(providers, signIns, opaque),
    complete: new CompleteSocialSignInUseCase(
      providers,
      signIns,
      opaque,
      transactions,
      linkIdentity,
      startSession,
      identities, // prumo:apple
      deleteAccount, // prumo:apple
    ),
    exchange: new ExchangeSocialCodeUseCase(signIns, opaque, transactions, startSession),
    // prumo:apple
    deleteAccount,
    startDeletion: new StartAccountDeletionUseCase(signIns, opaque),
    resumeDeletion: new ResumeAccountDeletionUseCase(providers, signIns, opaque, transactions),
    // prumo:end-apple
  }
}
