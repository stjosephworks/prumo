import { USER_TOOL_SCOPES } from './tools/users.tool'

// Every scope this server offers, as the consent page words it. A module adds its read and write here, with its
// tools' scopes below.
export const SCOPES: Record<string, string> = {
  'profile:read': 'Read your profile',
  'profile:write': 'Change your display name, language and timezone',
}

export const TOOL_SCOPES: Record<string, string> = { ...USER_TOOL_SCOPES }

// The scopes a batch of JSON-RPC messages needs and the token lacks, all of them at once: MCP asks for one
// challenge per operation, not one per retry.
export function missingScopes(messages: unknown, granted: readonly string[]): string[] {
  const needed = [messages]
    .flat()
    .flatMap((message) => {
      const call = message as { method?: unknown; params?: { name?: unknown } } | null

      return call?.method === 'tools/call' && typeof call.params?.name === 'string'
        ? [TOOL_SCOPES[call.params.name]]
        : []
    })
    .filter((scope): scope is string => scope !== undefined)

  return [...new Set(needed)].filter((scope) => !granted.includes(scope))
}
