import { FakeAccessTokens } from '@test/support/fakes/fake-access-tokens'
import { FakeMailer } from '@test/support/fakes/fake-mailer' // prumo:mail
import { FakeOneTimeCodes } from '@test/support/fakes/fake-one-time-codes' // prumo:codes
import { FakeOpaqueTokens } from '@test/support/fakes/fake-opaque-tokens'
import { FakePasswordHasher } from '@test/support/fakes/fake-password-hasher' // prumo:password
import { FakeTextMessages } from '@test/support/fakes/fake-text-messages' // prumo:sms
import { ImmediateTransactionManager } from '@test/support/fakes/immediate-transaction-manager'
import { InMemoryOneTimeCodeRepository } from '@test/support/fakes/in-memory-one-time-code.repository' // prumo:codes
import { InMemoryProfileRepository } from '@test/support/fakes/in-memory-profile.repository'
import { InMemorySessionRepository } from '@test/support/fakes/in-memory-session.repository'
import { InMemoryUserRepository } from '@test/support/fakes/in-memory-user.repository'
import type { SignUpDto } from '@/domain/auth/dto/sign-up.dto' // prumo:password
import { User } from '@/domain/auth/entities/user.entity'
import { IssueCodeUseCase } from '@/domain/auth/use-cases/issue-code.use-case' // prumo:codes
import { RefreshSessionUseCase } from '@/domain/auth/use-cases/refresh-session.use-case'
import { RequestPasswordResetUseCase } from '@/domain/auth/use-cases/request-password-reset.use-case' // prumo:email
import { RequestPhoneCodeUseCase } from '@/domain/auth/use-cases/request-phone-code.use-case' // prumo:phone-code
import { RequestSignInCodeUseCase } from '@/domain/auth/use-cases/request-sign-in-code.use-case' // prumo:email-code
import { ResetPasswordUseCase } from '@/domain/auth/use-cases/reset-password.use-case' // prumo:email
import { SignInUseCase } from '@/domain/auth/use-cases/sign-in.use-case' // prumo:password
import { SignInWithCodeUseCase } from '@/domain/auth/use-cases/sign-in-with-code.use-case' // prumo:email-code
import { SignInWithPhoneCodeUseCase } from '@/domain/auth/use-cases/sign-in-with-phone-code.use-case' // prumo:phone-code
import { SignOutUseCase } from '@/domain/auth/use-cases/sign-out.use-case'
import { SignUpUseCase } from '@/domain/auth/use-cases/sign-up.use-case' // prumo:password
import {
  type SessionTokens,
  StartSessionUseCase,
} from '@/domain/auth/use-cases/start-session.use-case'
import { VerifyEmailUseCase } from '@/domain/auth/use-cases/verify-email.use-case' // prumo:email
import { Profile } from '@/domain/users/entities/profile.entity'
import { CreateProfileUseCase } from '@/domain/users/use-cases/create-profile.use-case'
import { LibPhoneNumbers } from '@/infra/sms/libphonenumber-phone-numbers.adapter' // prumo:phone-code

// Every auth use case wired to in-memory ports, sharing one set of them as the container would.
export function authFakes() {
  const users = new InMemoryUserRepository()
  const sessions = new InMemorySessionRepository()
  const profiles = new InMemoryProfileRepository()
  const tokens = new FakeAccessTokens()
  const opaque = new FakeOpaqueTokens()
  const transactions = new ImmediateTransactionManager()
  const startSession = new StartSessionUseCase(sessions, tokens, opaque)
  const createProfile = new CreateProfileUseCase(profiles)
  const hasher = new FakePasswordHasher() // prumo:password
  // prumo:codes
  const codes = new InMemoryOneTimeCodeRepository()
  const oneTimeCodes = new FakeOneTimeCodes()
  // prumo:end-codes
  const mailer = new FakeMailer() // prumo:mail
  const texts = new FakeTextMessages() // prumo:sms
  // prumo:phone-code
  // The real reader, which needs nothing: it is the API's own rule of what a number is.
  const phones = new LibPhoneNumbers(['US', 'BR'])
  // prumo:end-phone-code
  // prumo:codes
  const issueCode = new IssueCodeUseCase(
    codes,
    oneTimeCodes,
    transactions,
    mailer, // prumo:mail
    texts, // prumo:sms
  )
  // prumo:end-codes
  // prumo:email
  const verifyEmail = new VerifyEmailUseCase(users, codes, oneTimeCodes, transactions, startSession)
  // prumo:end-email

  // An account that is already in and confirmed, whatever the project's way in: what a test of sessions needs.
  async function signedIn(email = 'ana@example.com'): Promise<SessionTokens> {
    const user = new User({ email })

    user.verifyEmail(new Date())
    await users.save(user)
    await profiles.save(new Profile(user.id, Profile.nameFor(email)))

    return startSession.execute(user.id)
  }

  // prumo:password
  const signUp = new SignUpUseCase(
    users,
    hasher,
    transactions,
    createProfile,
    startSession,
    issueCode, // prumo:email
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
  // prumo:end-password

  return {
    users,
    sessions,
    profiles,
    signedIn,
    refresh: new RefreshSessionUseCase(sessions, tokens, opaque, transactions),
    signOut: new SignOutUseCase(sessions),
    // prumo:password
    hasher,
    signUp,
    register,
    signIn: new SignInUseCase(users, hasher, startSession),
    // prumo:end-password
    // prumo:codes
    codes,
    issueCode,
    // prumo:end-codes
    mailer, // prumo:mail
    texts, // prumo:sms
    // prumo:email
    verifyEmail,
    requestPasswordReset: new RequestPasswordResetUseCase(users, issueCode),
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
    // prumo:email-code
    requestSignInCode: new RequestSignInCodeUseCase(issueCode),
    signInWithCode: new SignInWithCodeUseCase(
      users,
      sessions,
      codes,
      oneTimeCodes,
      transactions,
      createProfile,
      startSession,
    ),
    // prumo:end-email-code
    // prumo:phone-code
    requestPhoneCode: new RequestPhoneCodeUseCase(phones, issueCode),
    signInWithPhoneCode: new SignInWithPhoneCodeUseCase(
      users,
      codes,
      oneTimeCodes,
      phones,
      transactions,
      createProfile,
      startSession,
    ),
    // prumo:end-phone-code
  }
}
