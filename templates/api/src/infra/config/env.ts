import { existsSync } from 'node:fs'
import { z } from 'zod'

// Written as a browser sends it in an Origin header: scheme, host and port, with no path or trailing slash.
const origin = z.url().transform((url) => new URL(url).origin)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  // Where this API is reached from outside: the issuer of its tokens, and what decides whether cookies are Secure.
  API_URL: z.url(),
  // Every web app this API answers, comma-separated. The first is the one MCP consent opens on.
  WEB_ORIGIN: z
    .string()
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.tuple([origin], origin)),
  // Who may name the client's address in X-Forwarded-For, which the rate limits and the logs read: nobody (false),
  // whatever reaches the API (true, only where nothing but the platform's proxy can), or the proxies' IPs or CIDRs,
  // comma-separated. Fastify refuses a hop count: a client that reaches the API directly could forge it.
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((value) =>
      value === 'false' || value === 'true'
        ? value === 'true'
        : value.split(',').map((entry) => entry.trim()),
    )
    .pipe(
      z.union([z.boolean(), z.array(z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()])).min(1)]),
    ),
  // prumo:phone-code
  // The countries a sign-in text may go to, as ISO 3166 codes, comma-separated. Required: a paid text to anywhere is a
  // bill an attacker runs up by asking for codes to numbers they pay for.
  SMS_COUNTRIES: z
    .string()
    .transform((value) => value.split(',').map((code) => code.trim().toUpperCase()))
    .pipe(z.array(z.string().regex(/^[A-Z]{2}$/)).min(1)),
  // prumo:end-phone-code
  // prumo:social
  // Where a mobile app is sent back after signing in with a provider: its own scheme, as in app.json.
  MOBILE_APP_SCHEME: z
    .string()
    .regex(/^[a-z][a-z0-9+.-]*$/)
    .optional(),
  // prumo:end-social
  // prumo:google
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  // prumo:end-google
  // prumo:apple
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_TEAM_ID: z.string().min(1).optional(),
  APPLE_KEY_ID: z.string().min(1).optional(),
  // The .p8 key's contents; on one line, with its line breaks written as \n.
  APPLE_PRIVATE_KEY: z.string().min(1).optional(),
  // prumo:end-apple
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']),
})

export type Env = z.infer<typeof envSchema>

export const ENV = Symbol('Env')

export function validate(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw)

  if (!result.success) {
    const named = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')
    throw new Error(`Invalid environment: ${named}`)
  }

  loaded = result.data
  return result.data
}

let loaded: Env | undefined

export function loadEnv(): Env {
  if (loaded !== undefined) {
    return loaded
  }

  if (process.env.NODE_ENV !== 'production' && existsSync('.env')) {
    process.loadEnvFile('.env')
  }

  return validate(process.env)
}
