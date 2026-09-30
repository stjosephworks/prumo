import { existsSync } from 'node:fs'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().min(1),
  AUTH_DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().min(1),
  WEB_ORIGIN: z.string().min(1),
  MOBILE_APP_SCHEME: z
    .string()
    .regex(/^[a-z][a-z0-9+.-]*$/)
    .optional(),
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
