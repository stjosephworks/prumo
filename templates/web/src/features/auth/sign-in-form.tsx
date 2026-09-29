import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import type { AuthClient } from './auth-client'
import { sessionQuery } from './session'

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

type SignInValues = z.infer<typeof schema>

export function SignInForm({ auth, redirect }: { auth: AuthClient; redirect: string | undefined }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<SignInValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: SignInValues) {
    const result = await auth.signIn.email(values)

    if (result.error !== null) {
      applyServerError(ApiError.fromAuthError(result.error), ['email', 'password'], form.setError)
      return
    }

    // prumo:mcp
    // Signing in during an MCP client's authorization: Better Auth has already sent the browser on.
    if (result.data.redirect) {
      return
    }

    // prumo:end-mcp
    // Invalidating is not enough: nothing observes the session, and the protected route's ensureQueryData
    // would keep returning the cached null. Refetching replaces it before the route reads it.
    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    await navigate({ to: redirect ?? '/' })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.email !== undefined}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" {...form.register('email')} />
          <FieldError errors={[errors.email]} />
        </Field>
        <Field data-invalid={errors.password !== undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        Sign in
      </Button>
      <p className="text-sm text-muted-foreground">
        No account? <Link to="/sign-up">Sign up</Link>
      </p>
    </form>
  )
}
