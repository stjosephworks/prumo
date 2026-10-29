'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useClients } from '@/features/clients/clients'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useCooldown } from '@/features/forms/use-cooldown'
import { rich, useLocalePath, useMessages } from '@/i18n/i18n'
import { format } from '@/i18n/locales'
import type { Messages } from '@/i18n/messages'

const schemaOf = (messages: Messages) =>
  z.object({ code: z.string().regex(/^\d{6}$/, messages.auth.verifyEmail.sixDigits) })

type VerifyEmailValues = z.infer<ReturnType<typeof schemaOf>>

export function VerifyEmailForm({
  auth,
  email,
}: {
  auth: Pick<AuthClient, 'verifyEmail' | 'requestEmailVerification' | 'getSession'>
  email: string
}) {
  const messages = useMessages()
  const localePath = useLocalePath()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [resent, setResent] = useState(false)
  const [wait, startWait] = useCooldown()
  const schema = useMemo(() => schemaOf(messages), [messages])
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
      applyServerError(error, ['code'], form.setError, messages)
      return
    }

    // A confirmed email signs the user in; refetch so the protected routes see the session.
    await queryClient.refetchQueries({ queryKey: sessionQuery(auth).queryKey })
    router.push(localePath('/account'))
  }

  async function resend() {
    try {
      await auth.requestEmailVerification(email)
    } catch (error) {
      // A code went to this address moments ago; the API says when the next may.
      if (error instanceof ApiError && error.retryAfter !== undefined) {
        setResent(false)
        startWait(error.retryAfter)
        return
      }

      throw error
    }

    setResent(true)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        {rich(messages.auth.verifyEmail.sentTo, { email: <strong>{email}</strong> })}
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
      </FieldGroup>
      <Button type="submit" disabled={isSubmitting}>
        {messages.auth.verifyEmail.submit}
      </Button>
      <Button type="button" variant="outline" onClick={resend} disabled={wait > 0}>
        {wait > 0
          ? format(messages.forms.sendNewCodeIn, { seconds: wait })
          : messages.forms.sendNewCode}
      </Button>
      {resent && (
        <p role="status" className="text-sm text-muted-foreground">
          {messages.forms.newCodeSent}
        </p>
      )}
    </form>
  )
}

// The address the code was sent to arrives in the URL, from sign-up or from a sign-in refused for it.
export function VerifyEmail() {
  return <VerifyEmailForm auth={useClients().auth} email={useSearchParams().get('email') ?? ''} />
}
