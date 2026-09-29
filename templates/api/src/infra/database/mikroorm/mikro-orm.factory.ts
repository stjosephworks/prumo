import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import type { Env } from '@/infra/config/env'
import { ProfileSchema } from './entities/profile.schema'

export function createOrmConfig(env: Pick<Env, 'DATABASE_URL' | 'NODE_ENV'>) {
  return defineConfig({
    clientUrl: env.DATABASE_URL,
    entities: [ProfileSchema],
    extensions: [Migrator],
    migrations: { path: './migrations', snapshot: false },
    debug: env.NODE_ENV === 'development',
  })
}
