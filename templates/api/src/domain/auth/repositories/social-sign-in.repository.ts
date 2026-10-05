import type { SocialSignIn } from '@/domain/auth/entities/social-sign-in.entity'

export interface SocialSignInRepository {
  // Reads the row and holds it until the surrounding transaction ends, so a callback or a code is used once.
  lockById(id: string): Promise<SocialSignIn | null>
  save(signIn: SocialSignIn): Promise<void>
}

export const SOCIAL_SIGN_IN_REPOSITORY = Symbol('SocialSignInRepository')
