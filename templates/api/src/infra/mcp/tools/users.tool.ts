import type { McpServer } from '@modelcontextprotocol/server'
import type { DependencyContainer } from 'tsyringe'
import { profileResponseSchema } from '@/domain/users/dto/profile-response.dto'
import { updateProfileSchema } from '@/domain/users/dto/update-profile.dto'
import type { Profile } from '@/domain/users/entities/profile.entity'
import { FindProfileUseCase } from '@/domain/users/use-cases/find-profile.use-case'
import { UpdateProfileUseCase } from '@/domain/users/use-cases/update-profile.use-case'

// MCP sends whatever a tool returns, so the output schema is applied here: nothing drops unlisted fields.
function asResult(profile: Profile) {
  const data = JSON.parse(JSON.stringify(profileResponseSchema.parse(profile)))

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  }
}

export function registerUserTools(
  server: McpServer,
  container: DependencyContainer,
  userId: string,
): void {
  server.registerTool(
    'get_profile',
    { description: "Read the signed-in user's profile." },
    async () => asResult(await container.resolve(FindProfileUseCase).execute(userId)),
  )

  server.registerTool(
    'update_profile',
    {
      description: "Change the signed-in user's display name, locale or timezone.",
      inputSchema: updateProfileSchema,
    },
    async (changes) =>
      asResult(await container.resolve(UpdateProfileUseCase).execute(userId, changes)),
  )
}
