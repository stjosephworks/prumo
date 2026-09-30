import { createMcpHandler, type McpHttpHandler, McpServer } from '@modelcontextprotocol/server'
import type { DependencyContainer } from 'tsyringe'
import { registerUserTools } from './tools/users.tool'

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
