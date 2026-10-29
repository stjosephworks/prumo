import { Migrator } from '@mikro-orm/migrations'
import { defineConfig } from '@mikro-orm/postgresql'
import type { Env } from '@/infra/config/env'
import { AuthorizationSchema } from './entities/authorization.schema' // prumo:mcp
import { IdentitySchema } from './entities/identity.schema' // prumo:social
import { OneTimeCodeSchema } from './entities/one-time-code.schema' // prumo:codes
import { ProfileSchema } from './entities/profile.schema'
import { SessionSchema } from './entities/session.schema'
import { SocialSignInSchema } from './entities/social-sign-in.schema' // prumo:social
import { UserSchema } from './entities/user.schema'

export function createOrmConfig(env: Pick<Env, 'DATABASE_URL' | 'NODE_ENV'>) {
  return defineConfig({
    clientUrl: env.DATABASE_URL,
    entities: [
      UserSchema,
      ProfileSchema,
      SessionSchema,
      AuthorizationSchema, // prumo:mcp
      OneTimeCodeSchema, // prumo:codes
      IdentitySchema, // prumo:social
      SocialSignInSchema, // prumo:social
    ],
    extensions: [Migrator],
    migrations: { path: './migrations', snapshot: false },
    debug: env.NODE_ENV === 'development',
  })
}
