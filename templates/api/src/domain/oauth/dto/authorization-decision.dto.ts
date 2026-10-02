import { z } from 'zod'

export const authorizationDecisionSchema = z.strictObject({ accept: z.boolean() })

export type AuthorizationDecisionDto = z.infer<typeof authorizationDecisionSchema>

export const authorizationRedirectSchema = z.object({ redirectTo: z.string() })
