import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router' // prumo:email
import { Controller, useForm } from 'react-hook-form'
import { View } from 'react-native'
import { z } from 'zod'
import { type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

type SignInValues = z.infer<typeof schema>

export function SignInForm({
  auth,
  onSignedIn,
}: {
  auth: Pick<AuthClient, 'signIn' | 'getSession'>
  onSignedIn: () => void
}) {
  const queryClient = useQueryClient()
  const router = useRouter() // prumo:email
  const form = useForm<SignInValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: SignInValues) {
    try {
      await auth.signIn(values)
    } catch (error) {
      // prumo:email
      // The password was right and the email is not confirmed yet: the code screen offers a new code.
      if ((error as { code?: string }).code === 'email_not_verified') {
        router.push({ pathname: '/verify-email', params: { email: values.email } })
        return
      }

      // prumo:end-email
      applyServerError(error, ['email', 'password'], form.setError)
      return
    }

    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onSignedIn()
  }

  return (
    <View className="gap-6">
      <FormError errors={errors} />
      <Controller
        control={form.control}
        name="email"
        render={({ field }) => (
          <Field
            label="Email"
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
      <Controller
        control={form.control}
        name="password"
        render={({ field }) => (
          <Field
            label="Password"
            secureTextEntry
            autoComplete="current-password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errors.password?.message}
          />
        )}
      />
      <Button label="Sign in" disabled={isSubmitting} onPress={form.handleSubmit(onSubmit)} />
    </View>
  )
}
