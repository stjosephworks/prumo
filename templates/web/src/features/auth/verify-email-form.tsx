import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'

const schema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits from the email') })

type VerifyEmailValues = z.infer<typeof schema>

export function VerifyEmailForm({
  auth,
  email,
}: {
  auth: Pick<AuthClient, 'verifyEmail' | 'requestEmailVerification' | 'getSession'>
  email: string
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [resent, setResent] = useState(false)
  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { code: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: VerifyEmailValues) {
    try {
      await auth.verifyEmail({ email, code: values.code })
    } catch (error) {
      applyServerError(error, ['code'], form.setError)
      return
    }

    // A confirmed email signs the user in; refetch so the protected routes see the session.
    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    await navigate({ to: '/' })
  }

  async function resend() {
    await auth.requestEmailVerification(email)
    setResent(true)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        We sent a 6-digit code to <strong>{email}</strong>.
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
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        Confirm email
      </Button>
      <Button type="button" variant="outline" onClick={resend}>
        Send a new code
      </Button>
      {resent && (
        <p role="status" className="text-sm text-muted-foreground">
          A new code is on its way. The previous one no longer works.
        </p>
      )}
    </form>
  )
}
