import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
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

const schema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits from the email') })

type VerifyEmailValues = z.infer<typeof schema>

export function VerifyEmailForm({
  auth,
  email,
}: {
  auth: Pick<AuthClient, 'verifyEmail' | 'requestEmailVerification'>
  email: string
}) {
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

    // The next page is a new page load, with a cache of its own that asks for the session afresh.
    navigate.to('/account')
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

// The address the code was sent to arrives in the URL, from sign-up or from a sign-in refused for it.
function VerifyEmailPart() {
  return (
    <VerifyEmailForm
      auth={useClients().auth}
      email={new URLSearchParams(window.location.search).get('email') ?? ''}
    />
  )
}

export const VerifyEmail = island(VerifyEmailPart)
