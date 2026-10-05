import { z } from 'zod'

// What the consent page shows. The hosts come first: a name is whatever the client chose to write.
export const authorizationViewSchema = z.object({
  clientId: z.string(),
  clientName: z.string(),
  clientHost: z.string(),
  redirectHost: z.string(),
  // A localhost redirect cannot prove which program is listening there, so the page warns about it.
  redirectsToThisDevice: z.boolean(),
  scopes: z.array(z.object({ scope: z.string(), description: z.string() })),
})

export type AuthorizationViewDto = z.infer<typeof authorizationViewSchema>
