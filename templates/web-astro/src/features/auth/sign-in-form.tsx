import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useClients } from '@/features/clients/clients'
import { island } from '@/features/clients/island'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { navigate } from '@/lib/navigate'

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

type SignInValues = z.infer<typeof schema>

export function SignInForm({
  auth,
  redirect,
}: {
  auth: Pick<AuthClient, 'signIn'>
  redirect: string | undefined
}) {
  const form = useForm<SignInValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: SignInValues) {
    try {
      await auth.signIn(values)
    } catch (error) {
      // prumo:email
      // The password was right and the email is not confirmed yet: the code page offers a new code.
      if ((error as { code?: string }).code === 'email_not_verified') {
        navigate.to(`/verify-email?${new URLSearchParams({ email: values.email })}`)
        return
      }

      // prumo:end-email
      applyServerError(error, ['email', 'password'], form.setError)
      return
    }

    // The next page is a new page load, with a cache of its own that asks for the session afresh.
    navigate.to(redirect ?? '/account')
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
        No account? <a href="/sign-up">Sign up</a>
      </p>
      {/* prumo:email */}
      <p className="text-sm text-muted-foreground">
        <a href="/forgot-password">Forgot your password?</a>
      </p>
      {/* prumo:end-email */}
    </form>
  )
}

// What the sign-in page renders: the form, with the address the visitor was turned away from.
function SignInPart() {
  const { auth } = useClients()
  const redirect = new URLSearchParams(window.location.search).get('redirect') ?? undefined

  return <SignInForm auth={auth} redirect={redirect} />
}

export const SignIn = island(SignInPart)
