import { loadEnv } from '@/infra/config/env'
import { createAuth } from './auth.factory'

// Read by Better Auth's CLI (`auth migrate --config`), which only needs the schema, not the hooks.
export const auth = createAuth(loadEnv())
