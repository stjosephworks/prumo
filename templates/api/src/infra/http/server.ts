// tsyringe reads decorator metadata as each class is loaded, so this must come before any other import.
import 'reflect-metadata'
import { MikroORM } from '@mikro-orm/postgresql'
import type { Pool } from 'pg'
import { AUTH, type Auth } from '@/infra/auth/auth.factory'
import { loadEnv } from '@/infra/config/env'
import { createOrmConfig } from '@/infra/database/mikroorm/mikro-orm.factory'
import { createContainer } from '@/infra/di'
import { buildApp } from './app'

async function main(): Promise<void> {
  const env = loadEnv()
  const orm = await MikroORM.init(createOrmConfig(env))

  // MikroORM 7 no longer connects on init, so readiness would report the database down until a first query.
  await orm.connect()

  const container = createContainer({ env, orm })
  const app = await buildApp(container)

  // Handling the signals takes away Node's default exit, so every open pool must close for the process to end.
  app.addHook('onClose', async () => {
    await orm.close()
    await (container.resolve<Auth>(AUTH).options.database as Pool).end()
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => void app.close())
  }

  await app.listen({ port: env.PORT, host: '::' })
}

void main()
