import { createMcpHandler, type McpHttpHandler, McpServer } from '@modelcontextprotocol/server'
import type { DependencyContainer } from 'tsyringe'
import type { Env } from '@/infra/config/env'
import { registerUserTools } from './tools/users.tool'

// The protected resource MCP clients ask a token for; its access tokens carry it as their audience.
export function mcpResource(env: Pick<Env, 'API_URL'>): string {
  return `${env.API_URL}/api/mcp`
}

export function mcpResourceMetadataUrl(env: Pick<Env, 'API_URL'>): string {
  return `${env.API_URL}/.well-known/oauth-protected-resource/api/mcp`
}

// One server per request: the protocol is stateless, and each instance knows only its caller.
export function createMcpServerHandler(container: DependencyContainer): McpHttpHandler {
  return createMcpHandler(
    ({ authInfo }) => {
      const server = new McpServer({ name: 'api', version: '1.0.0' })
      const userId = authInfo?.extra?.userId

      if (typeof userId === 'string') {
        registerUserTools(server, container, userId)
      }

      return server
    },
    { legacy: 'reject' },
  )
}
