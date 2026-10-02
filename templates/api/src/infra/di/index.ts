import { EntityManager, MikroORM } from '@mikro-orm/postgresql'
import { type DependencyContainer, container as root } from 'tsyringe'
import { TRANSACTION_MANAGER } from '@/domain/shared/transactions/transaction-manager'
import { ENV, type Env } from '@/infra/config/env'
import { MikroOrmTransactionManager } from '@/infra/database/mikroorm/transactions/mikroorm-transaction-manager'
import { registerAuth } from './auth.di'
import { registerOauth } from './oauth.di' // prumo:mcp
import { registerUsers } from './users.di'

export type Dependencies = { env: Env; orm: MikroORM }

export function createContainer({ env, orm }: Dependencies): DependencyContainer {
  const container = root.createChildContainer()

  container.register(ENV, { useValue: env })
  container.register(MikroORM, { useValue: orm })
  // The global EntityManager: inside a request it resolves to that request's fork by itself.
  container.register(EntityManager, { useValue: orm.em })
  container.register(TRANSACTION_MANAGER, { useClass: MikroOrmTransactionManager })

  registerAuth(container)
  registerUsers(container)
  registerOauth(container) // prumo:mcp

  return container
}
