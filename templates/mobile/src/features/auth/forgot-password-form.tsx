import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import { z } from 'zod'
import type { AuthClient } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useMessages } from '@/i18n/i18n'

const schema = z.object({ email: z.email() })

type ForgotPasswordValues = z.infer<typeof schema>

export function ForgotPasswordForm({
  auth,
  onSent,
}: {
  auth: Pick<AuthClient, 'requestPasswordReset'>
  onSent: (email: string) => void
}) {
  const messages = useMessages()
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
      applyServerError(error, ['email'], form.setError, messages)
      return
    }

    // The API answers alike whether the account exists, so the next screen cannot tell either.
    onSent(values.email)
  }

  return (
    <View className="gap-6">
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="email"
        render={({ field }) => (
          <Field
            label={messages.auth.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.email?.message}
          />
        )}
      />
      <Button
        label={messages.auth.forgotPassword.submit}
        disabled={isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
    </View>
  )
}
