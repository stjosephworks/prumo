import { cimd } from '@better-auth/cimd' // prumo:mcp
import { fetchClientMetadataResource } from '@better-auth/cimd/node' // prumo:mcp
import { expo } from '@better-auth/expo'
import { mcp } from '@better-auth/mcp' // prumo:mcp
import { type BetterAuthPlugin, betterAuth } from 'better-auth'
import { jwt } from 'better-auth/plugins' // prumo:mcp
import { Pool } from 'pg'
import type { Env } from '@/infra/config/env'

type NewUser = { id: string; name: string }

export type AuthHooks = {
  onUserCreated?: (user: NewUser) => Promise<void>
}

export const AUTH = Symbol('Auth')

// prumo:mcp
// The protected resource MCP clients ask a token for; access tokens carry it as their audience.
export function mcpResource(env: Pick<Env, 'BETTER_AUTH_URL'>): string {
  return `${env.BETTER_AUTH_URL}/api/mcp`
}

// prumo:end-mcp
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

  // prumo:mcp
  plugins.push(
    jwt(),
    mcp({
      loginPage: `${env.WEB_ORIGIN}/sign-in`,
      consentPage: `${env.WEB_ORIGIN}/consent`,
      resource: mcpResource(env),
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' }),
  )

  // prumo:end-mcp
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
