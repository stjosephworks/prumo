import { oauthProviderClient } from '@better-auth/oauth-provider/client' // prumo:mcp
import { createAuthClient } from 'better-auth/react'
import type { Transport } from '@/api-contract'

export type AuthClient = ReturnType<typeof createAuth>

export function createAuth({ baseUrl, fetch }: { baseUrl: string; fetch: Transport }) {
  return createAuthClient({
    baseURL: baseUrl,
    basePath: '/api/auth',
    fetchOptions: { customFetchImpl: fetch },
    // prumo:mcp
    // Carries the signed query of an MCP client's authorization through sign-in and consent.
    plugins: [oauthProviderClient()],
    // prumo:end-mcp
  })
}
