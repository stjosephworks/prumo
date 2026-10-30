import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { Text, View } from 'react-native'
import { z } from 'zod'
import { type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useMessages } from '@/i18n/i18n'
import type { Messages } from '@/i18n/messages'

const schemaOf = (messages: Messages) =>
  z.object({
    code: z.string().regex(/^\d{6}$/, messages.auth.verifyEmail.sixDigits),
    password: z.string().min(8).max(128),
  })

type ResetPasswordValues = z.infer<ReturnType<typeof schemaOf>>

export function ResetPasswordForm({
  auth,
  email,
  onReset,
}: {
  auth: Pick<AuthClient, 'resetPassword' | 'getSession'>
  email: string
  onReset: () => void
}) {
  const messages = useMessages()
  const queryClient = useQueryClient()
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

    // Every other session was ended; this one starts signed in.
    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onReset()
  }

  return (
    <View className="gap-6">
      <Text className="text-sm text-neutral-500">
        If {email} has an account, a 6-digit code is on its way to it.
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
      <Controller
        control={form.control}
        name="password"
        render={({ field }) => (
          <Field
            label={messages.auth.resetPassword.password}
            secureTextEntry
            autoComplete="new-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      <Button
        label={messages.auth.resetPassword.submit}
        disabled={isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
    </View>
  )
}
