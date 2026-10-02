import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import type { Env } from '@/infra/config/env'
import { AuthorizationSchema } from './entities/authorization.schema' // prumo:mcp
import { ProfileSchema } from './entities/profile.schema'
import { SessionSchema } from './entities/session.schema'
import { UserSchema } from './entities/user.schema'

export function createOrmConfig(env: Pick<Env, 'DATABASE_URL' | 'NODE_ENV'>) {
  return defineConfig({
    clientUrl: env.DATABASE_URL,
    entities: [
      UserSchema,
      ProfileSchema,
      SessionSchema,
      AuthorizationSchema, // prumo:mcp
    ],
    extensions: [Migrator],
    migrations: { path: './migrations', snapshot: false },
    debug: env.NODE_ENV === 'development',
  })
}
