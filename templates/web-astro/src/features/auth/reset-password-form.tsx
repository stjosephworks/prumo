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
import { rich, useLocalePath, useMessages } from '@/i18n/i18n'
import type { Messages } from '@/i18n/messages'
import { navigate } from '@/lib/navigate'

const schemaOf = (messages: Messages) =>
  z.object({
    code: z.string().regex(/^\d{6}$/, messages.auth.verifyEmail.sixDigits),
    password: z.string().min(8).max(128),
  })

type ResetPasswordValues = z.infer<ReturnType<typeof schemaOf>>

export function ResetPasswordForm({
  auth,
  email,
}: {
  auth: Pick<AuthClient, 'resetPassword'>
  email: string
}) {
  const messages = useMessages()
  const localePath = useLocalePath()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(schemaOf(messages)),
    mode: 'onTouched',
    defaultValues: { code: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: ResetPasswordValues) {
    try {
      await auth.resetPassword({ email, ...values })
    } catch (error) {
      applyServerError(error, ['code', 'password'], form.setError, messages)
      return
    }

    // The next page is a new page load, with a cache of its own that asks for the session afresh.
    navigate.to(localePath('/account'))
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {rich(messages.auth.resetPassword.sentTo, { email: <strong>{email}</strong> })}
      </p>
      <FormError errors={errors} />
      <FieldGroup>
        <Field data-invalid={errors.code !== undefined}>
          <FieldLabel htmlFor="code">{messages.forms.code}</FieldLabel>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            {...form.register('code')}
          />
          <FieldError errors={[errors.code]} />
        </Field>
        <Field data-invalid={errors.password !== undefined}>
          <FieldLabel htmlFor="password">{messages.auth.resetPassword.password}</FieldLabel>
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
        {messages.auth.resetPassword.submit}
      </Button>
    </form>
  )
}

function ResetPasswordPart() {
  return (
    <ResetPasswordForm
      auth={useClients().auth}
      email={new URLSearchParams(window.location.search).get('email') ?? ''}
    />
  )
}

export const ResetPassword = island(ResetPasswordPart)
