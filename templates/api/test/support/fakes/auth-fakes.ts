import { FakeAccessTokens } from '@test/support/fakes/fake-access-tokens'
import { FakeOpaqueTokens } from '@test/support/fakes/fake-opaque-tokens'
import { FakePasswordHasher } from '@test/support/fakes/fake-password-hasher'
import { ImmediateTransactionManager } from '@test/support/fakes/immediate-transaction-manager'
import { InMemoryProfileRepository } from '@test/support/fakes/in-memory-profile.repository'
import { InMemorySessionRepository } from '@test/support/fakes/in-memory-session.repository'
import { InMemoryUserRepository } from '@test/support/fakes/in-memory-user.repository'
import { RefreshSessionUseCase } from '@/domain/auth/use-cases/refresh-session.use-case'
import { SignInUseCase } from '@/domain/auth/use-cases/sign-in.use-case'
import { SignOutUseCase } from '@/domain/auth/use-cases/sign-out.use-case'
import { SignUpUseCase } from '@/domain/auth/use-cases/sign-up.use-case'
import { StartSessionUseCase } from '@/domain/auth/use-cases/start-session.use-case'
import { CreateProfileUseCase } from '@/domain/users/use-cases/create-profile.use-case'

// Every auth use case wired to in-memory ports, sharing one set of them as the container would.
export function authFakes() {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const profiles = new InMemoryProfileRepository()
  const hasher = new FakePasswordHasher()
  const tokens = new FakeAccessTokens()
  const opaque = new FakeOpaqueTokens()
  const transactions = new ImmediateTransactionManager()
  const startSession = new StartSessionUseCase(sessions, tokens, opaque)

  return {
    users,
    sessions,
    profiles,
    hasher,
    signUp: new SignUpUseCase(
      users,
      hasher,
      transactions,
      new CreateProfileUseCase(profiles),
      startSession,
    ),
    signIn: new SignInUseCase(users, hasher, startSession),
    refresh: new RefreshSessionUseCase(sessions, tokens, opaque, transactions),
    signOut: new SignOutUseCase(sessions),
  }
}
