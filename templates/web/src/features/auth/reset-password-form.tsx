import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits from the email'),
  password: z.string().min(8).max(128),
})

type ResetPasswordValues = z.infer<typeof schema>

export function ResetPasswordForm({
  auth,
  email,
}: {
  auth: Pick<AuthClient, 'resetPassword' | 'getSession'>
  email: string
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { code: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: ResetPasswordValues) {
    try {
      await auth.resetPassword({ email, ...values })
    } catch (error) {
      applyServerError(error, ['code', 'password'], form.setError)
      return
    }

    // Every other session was ended; this one starts signed in.
    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    await navigate({ to: '/' })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        If <strong>{email}</strong> has an account, a 6-digit code is on its way to it.
      </p>
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.code !== undefined}>
          <FieldLabel htmlFor="code">Code</FieldLabel>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            {...form.register('code')}
          />
          <FieldError errors={[errors.code]} />
        </Field>
        <Field data-invalid={errors.password !== undefined}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
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
        Set the new password
      </Button>
    </form>
  )
}
