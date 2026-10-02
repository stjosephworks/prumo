import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Text, View } from 'react-native'
import { z } from 'zod'
import { type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'

const schema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits from the email') })

type VerifyEmailValues = z.infer<typeof schema>

export function VerifyEmailForm({
  auth,
  email,
  onVerified,
}: {
  auth: Pick<AuthClient, 'verifyEmail' | 'requestEmailVerification' | 'getSession'>
  email: string
  onVerified: () => void
}) {
  const queryClient = useQueryClient()
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

    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onVerified()
  }

  async function resend() {
    await auth.requestEmailVerification(email)
    setResent(true)
  }

  return (
    <View className="gap-6">
      <Text className="text-sm text-neutral-500">We sent a 6-digit code to {email}.</Text>
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="code"
        render={({ field }) => (
          <Field
            label="Code"
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
      <Button label="Confirm email" disabled={isSubmitting} onPress={form.handleSubmit(onSubmit)} />
      <Button label="Send a new code" variant="outline" onPress={resend} />
      {resent ? (
        <Text accessibilityRole="text" className="text-sm text-neutral-500">
          A new code is on its way. The previous one no longer works.
        </Text>
      ) : null}
    </View>
  )
}
