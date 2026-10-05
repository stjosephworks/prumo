import { FakeAccessTokens } from '@test/support/fakes/fake-access-tokens'
import { FakeMailer } from '@test/support/fakes/fake-mailer' // prumo:email
import { FakeOneTimeCodes } from '@test/support/fakes/fake-one-time-codes' // prumo:email
import { FakeOpaqueTokens } from '@test/support/fakes/fake-opaque-tokens'
import { FakePasswordHasher } from '@test/support/fakes/fake-password-hasher'
import { ImmediateTransactionManager } from '@test/support/fakes/immediate-transaction-manager'
import { InMemoryEmailCodeRepository } from '@test/support/fakes/in-memory-email-code.repository' // prumo:email
import { InMemoryProfileRepository } from '@test/support/fakes/in-memory-profile.repository'
import { InMemorySessionRepository } from '@test/support/fakes/in-memory-session.repository'
import { InMemoryUserRepository } from '@test/support/fakes/in-memory-user.repository'
import type { SignUpDto } from '@/domain/auth/dto/sign-up.dto'
import { IssueEmailCodeUseCase } from '@/domain/auth/use-cases/issue-email-code.use-case' // prumo:email
import { RefreshSessionUseCase } from '@/domain/auth/use-cases/refresh-session.use-case'
import { RequestPasswordResetUseCase } from '@/domain/auth/use-cases/request-password-reset.use-case' // prumo:email
import { ResetPasswordUseCase } from '@/domain/auth/use-cases/reset-password.use-case' // prumo:email
import { SignInUseCase } from '@/domain/auth/use-cases/sign-in.use-case'
import { SignOutUseCase } from '@/domain/auth/use-cases/sign-out.use-case'
import { SignUpUseCase } from '@/domain/auth/use-cases/sign-up.use-case'
import {
  type SessionTokens,
  StartSessionUseCase,
} from '@/domain/auth/use-cases/start-session.use-case'
import { VerifyEmailUseCase } from '@/domain/auth/use-cases/verify-email.use-case' // prumo:email
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
  // prumo:email
  const mailer = new FakeMailer()
  const codes = new InMemoryEmailCodeRepository()
  const oneTimeCodes = new FakeOneTimeCodes()
  const issueEmailCode = new IssueEmailCodeUseCase(codes, oneTimeCodes, mailer, transactions)
  const verifyEmail = new VerifyEmailUseCase(users, codes, oneTimeCodes, transactions, startSession)
  // prumo:end-email
  const signUp = new SignUpUseCase(
    users,
    hasher,
    transactions,
    new CreateProfileUseCase(profiles),
    startSession,
    issueEmailCode, // prumo:email
  )

  // Signs up and, where the email must be confirmed first, confirms it: a session either way.
  async function register(request: SignUpDto): Promise<SessionTokens> {
    const started = await signUp.execute(request)

    // prumo:email
    if (started === null) {
      return verifyEmail.execute({ email: request.email, code: mailer.lastCode(request.email) })
    }

    // prumo:end-email
    if (started === null) {
      throw new Error('Sign-up opened no session')
    }

    return started
  }

  return {
    users,
    sessions,
    profiles,
    hasher,
    signUp,
    register,
    signIn: new SignInUseCase(users, hasher, startSession),
    refresh: new RefreshSessionUseCase(sessions, tokens, opaque, transactions),
    signOut: new SignOutUseCase(sessions),
    // prumo:email
    mailer,
    verifyEmail,
    requestPasswordReset: new RequestPasswordResetUseCase(users, issueEmailCode),
    resetPassword: new ResetPasswordUseCase(
      users,
      codes,
      sessions,
      oneTimeCodes,
      hasher,
      transactions,
      startSession,
    ),
    // prumo:end-email
  }
}
