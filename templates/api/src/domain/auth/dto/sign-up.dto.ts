import { z } from 'zod'

export const signUpSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  password: z.string().min(8).max(128),
})

export type SignUpDto = z.infer<typeof signUpSchema>
