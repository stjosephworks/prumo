import { expo } from '@better-auth/expo'
import { type BetterAuthPlugin, betterAuth } from 'better-auth'
import { Pool } from 'pg'
import type { Env } from '@/infra/config/env'

type NewUser = { id: string; name: string }

export type AuthHooks = {
  onUserCreated?: (user: NewUser) => Promise<void>
}

export const AUTH = Symbol('Auth')

export function createAuth(
  env: Pick<
    Env,
    | 'AUTH_DATABASE_URL'
    | 'BETTER_AUTH_SECRET'
    | 'BETTER_AUTH_URL'
    | 'WEB_ORIGIN'
    | 'MOBILE_APP_SCHEME'
  >,
  hooks: AuthHooks = {},
) {
  const mobile = env.MOBILE_APP_SCHEME
  const plugins: BetterAuthPlugin[] = mobile === undefined ? [] : [expo()]

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: mobile === undefined ? [env.WEB_ORIGIN] : [env.WEB_ORIGIN, `${mobile}://`],
    plugins,
    database: new Pool({
      connectionString: env.AUTH_DATABASE_URL,
      options: '-c search_path=auth',
    }),
    emailAndPassword: { enabled: true },
    advanced: { database: { generateId: 'uuid' } },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await hooks.onUserCreated?.(user)
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
export type AuthSession = Awaited<ReturnType<Auth['api']['getSession']>>
export type AuthUser = NonNullable<AuthSession>['user']
