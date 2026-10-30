import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Text, View } from 'react-native'
import { z } from 'zod'
import { ApiError, type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useCooldown } from '@/features/forms/use-cooldown'
import { useMessages } from '@/i18n/i18n'
import { format } from '@/i18n/locales'
import type { Messages } from '@/i18n/messages'

const schemaOf = (messages: Messages) =>
  z.object({ code: z.string().regex(/^\d{6}$/, messages.auth.verifyEmail.sixDigits) })

type VerifyEmailValues = z.infer<ReturnType<typeof schemaOf>>

export function VerifyEmailForm({
  auth,
  email,
  onVerified,
}: {
  auth: Pick<AuthClient, 'verifyEmail' | 'requestEmailVerification' | 'getSession'>
  email: string
  onVerified: () => void
}) {
  const messages = useMessages()
  const queryClient = useQueryClient()
  const [resent, setResent] = useState(false)
  const [wait, startWait] = useCooldown()
  const form = useForm<VerifyEmailValues>({
    resolver: zodResolver(schemaOf(messages)),
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

    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onVerified()
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
    <View className="gap-6">
      <Text className="text-sm text-neutral-500">
        {format(messages.auth.verifyEmail.sentTo, { email })}
      </Text>
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="code"
        render={({ field }) => (
          <Field
            label={messages.forms.code}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.code?.message}
          />
        )}
      />
      <Button
        label={messages.auth.verifyEmail.submit}
        disabled={isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
      <Button
        label={
          wait > 0
            ? format(messages.forms.sendNewCodeIn, { seconds: wait })
            : messages.forms.sendNewCode
        }
        variant="outline"
        disabled={wait > 0}
        onPress={resend}
      />
      {resent ? (
        <Text accessibilityRole="text" className="text-sm text-neutral-500">
          {messages.forms.newCodeSent}
        </Text>
      ) : null}
    </View>
  )
}
