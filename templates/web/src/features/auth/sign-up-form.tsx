import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.email(),
  password: z.string().min(8).max(128),
})

type SignUpValues = z.infer<typeof schema>

export function SignUpForm({ auth }: { auth: Pick<AuthClient, 'signUp' | 'getSession'> }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<SignUpValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { name: '', email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: SignUpValues) {
    const result = await auth.signUp(values).catch((error: unknown) => {
      applyServerError(error, ['name', 'email', 'password'], form.setError)
      return undefined
    })

    if (result === undefined) {
      return
    }

    // prumo:email
    if (result.verificationRequired) {
      await navigate({ to: '/verify-email', search: { email: values.email } })
      return
    }

    // prumo:end-email

    // Invalidating is not enough: nothing observes the session, and the protected route's ensureQueryData
    // would keep returning the cached null. Refetching replaces it before the route reads it.
    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    await navigate({ to: '/' })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.name !== undefined}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" autoComplete="name" {...form.register('name')} />
          <FieldError errors={[errors.name]} />
        </Field>
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
            autoComplete="new-password"
            {...form.register('password')}
          />
          <FieldError errors={[errors.password]} />
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        Create account
      </Button>
      <p className="text-sm text-muted-foreground">
        Already registered? <Link to="/sign-in">Sign in</Link>
      </p>
    </form>
  )
}
