import type { DependencyContainer } from 'tsyringe'
import { IDENTITY_PROVIDERS } from '@/domain/auth/ports/identity-providers.port'
import { IDENTITY_REPOSITORY } from '@/domain/auth/repositories/identity.repository'
import { SOCIAL_SIGN_IN_REPOSITORY } from '@/domain/auth/repositories/social-sign-in.repository'
import { ENV, type Env } from '@/infra/config/env'
import { MikroOrmIdentityRepository } from '@/infra/database/mikroorm/repositories/mikroorm-identity.repository'
import { MikroOrmSocialSignInRepository } from '@/infra/database/mikroorm/repositories/mikroorm-social-sign-in.repository'
import { OpenIdIdentityProviders } from '@/infra/social/openid-identity-providers.adapter'

export function registerSocial(container: DependencyContainer): void {
  container.register(IDENTITY_REPOSITORY, { useClass: MikroOrmIdentityRepository })
  container.register(SOCIAL_SIGN_IN_REPOSITORY, { useClass: MikroOrmSocialSignInRepository })
  // One instance, so each provider's discovery document is fetched once.
  container.register(IDENTITY_PROVIDERS, {
    useValue: new OpenIdIdentityProviders(container.resolve<Env>(ENV)),
  })
}
