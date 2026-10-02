import type { DependencyContainer } from 'tsyringe'
import { ACCESS_TOKENS } from '@/domain/auth/ports/access-tokens.port'
import { OPAQUE_TOKENS } from '@/domain/auth/ports/opaque-tokens.port'
import { PASSWORD_HASHER } from '@/domain/auth/ports/password-hasher.port'
import { SESSION_REPOSITORY } from '@/domain/auth/repositories/session.repository'
import { USER_REPOSITORY } from '@/domain/auth/repositories/user.repository'
import { Argon2PasswordHasher } from '@/infra/auth/argon2-password-hasher.adapter'
import { CryptoOpaqueTokens } from '@/infra/auth/crypto-opaque-tokens.adapter'
import { JoseAccessTokens } from '@/infra/auth/jose-access-tokens.adapter'
import { ENV, type Env } from '@/infra/config/env'
import { MikroOrmSessionRepository } from '@/infra/database/mikroorm/repositories/mikroorm-session.repository'
import { MikroOrmUserRepository } from '@/infra/database/mikroorm/repositories/mikroorm-user.repository'

export function registerAuth(container: DependencyContainer): void {
  container.register(USER_REPOSITORY, { useClass: MikroOrmUserRepository })
  container.register(SESSION_REPOSITORY, { useClass: MikroOrmSessionRepository })
  // One instance each: the hasher keeps its decoy hash, the signer its key.
  container.register(PASSWORD_HASHER, { useValue: new Argon2PasswordHasher() })
  container.register(ACCESS_TOKENS, { useValue: new JoseAccessTokens(container.resolve<Env>(ENV)) })
  container.register(OPAQUE_TOKENS, { useValue: new CryptoOpaqueTokens() })
}
