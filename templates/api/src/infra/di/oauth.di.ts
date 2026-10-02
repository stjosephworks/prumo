import type { DependencyContainer } from 'tsyringe'
import { AUTHORIZATION_CODES } from '@/domain/oauth/ports/authorization-codes.port'
import { CLIENT_METADATA } from '@/domain/oauth/ports/client-metadata.port'
import { AUTHORIZATION_REPOSITORY } from '@/domain/oauth/repositories/authorization.repository'
import { MikroOrmAuthorizationRepository } from '@/infra/database/mikroorm/repositories/mikroorm-authorization.repository'
import { CryptoAuthorizationCodes } from '@/infra/oauth/crypto-authorization-codes.adapter'
import { HttpsClientMetadata } from '@/infra/oauth/https-client-metadata.adapter'

export function registerOauth(container: DependencyContainer): void {
  container.register(AUTHORIZATION_REPOSITORY, { useClass: MikroOrmAuthorizationRepository })
  container.register(AUTHORIZATION_CODES, { useValue: new CryptoAuthorizationCodes() })
  // One instance, so its cache of client documents outlives a request.
  container.register(CLIENT_METADATA, { useValue: new HttpsClientMetadata() })
}
