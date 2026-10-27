'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useClients } from '@/features/clients/clients'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'

const schema = z.object({ email: z.email() })

type ForgotPasswordValues = z.infer<typeof schema>

export function ForgotPasswordForm({ auth }: { auth: Pick<AuthClient, 'requestPasswordReset'> }) {
  const router = useRouter()
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: ForgotPasswordValues) {
    try {
      await auth.requestPasswordReset(values.email)
    } catch (error) {
      applyServerError(error, ['email'], form.setError)
      return
    }

    // The API answers alike whether the account exists, so the next page cannot tell either.
    router.push(`/reset-password?${new URLSearchParams({ email: values.email })}`)
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
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        Send a reset code
      </Button>
    </form>
  )
}

export function ForgotPassword() {
  return <ForgotPasswordForm auth={useClients().auth} />
}
