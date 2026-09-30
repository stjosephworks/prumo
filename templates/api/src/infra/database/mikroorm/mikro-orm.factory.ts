import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import type { Env } from '@/infra/config/env'
import { AuthUserSchema } from './entities/auth-user.schema'
import { ProfileSchema } from './entities/profile.schema'

export function createOrmConfig(env: Pick<Env, 'DATABASE_URL' | 'NODE_ENV'>) {
  return defineConfig({
    clientUrl: env.DATABASE_URL,
    entities: [ProfileSchema, AuthUserSchema],
    extensions: [Migrator],
    migrations: { path: './migrations', snapshot: false },
    // Better Auth migrates its own schema; without this, every generated migration drops it.
    schemaGenerator: { ignoreSchema: ['auth'], skipTables: ['auth.user'] },
    debug: env.NODE_ENV === 'development',
  })
}
