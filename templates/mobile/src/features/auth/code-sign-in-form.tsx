import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Pressable, Text, View } from 'react-native'
import { z } from 'zod'
import { ApiError, type AuthClient, sessionQuery } from '@/api-contract'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { FormError } from '@/features/forms/form-error'
import { applyServerError } from '@/features/forms/server-errors'
import { useCooldown } from '@/features/forms/use-cooldown'

const addressSchema = z.object({ email: z.email() })

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6 digits from the email'),
})

type AddressValues = z.infer<typeof addressSchema>

type CodeValues = z.infer<typeof codeSchema>

type Auth = Pick<AuthClient, 'requestSignInCode' | 'signInWithCode' | 'getSession'>

// Two steps on one screen: the address, then the code sent to it. Entering it signs in, or creates the account.
export function CodeSignInForm({ auth, onSignedIn }: { auth: Auth; onSignedIn: () => void }) {
  const [email, setEmail] = useState<string>()
  const [wait, startWait] = useCooldown()

  // A code sent moments ago is still good, so a refusal to send another still leads to the code step.
  async function send(address: string): Promise<boolean> {
    try {
      await auth.requestSignInCode(address)
    } catch (error) {
      if (error instanceof ApiError && error.retryAfter !== undefined) {
        startWait(error.retryAfter)
        return true
      }

      throw error
    }

    return false
  }

  return email === undefined ? (
    <AddressStep send={send} onSent={setEmail} />
  ) : (
    <CodeStep
      auth={auth}
      email={email}
      wait={wait}
      resend={() => send(email)}
      onSignedIn={onSignedIn}
      onChangeAddress={() => setEmail(undefined)}
    />
  )
}

function AddressStep({
  send,
  onSent,
}: {
  send: (address: string) => Promise<boolean>
  onSent: (address: string) => void
}) {
  const form = useForm<AddressValues>({
    resolver: zodResolver(addressSchema),
    mode: 'onTouched',
    defaultValues: { email: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: AddressValues) {
    try {
      await send(values.email)
    } catch (error) {
      applyServerError(error, ['email'], form.setError)
      return
    }

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
      <Button
        label="Email me a code"
        disabled={isSubmitting}
        onPress={form.handleSubmit(onSubmit)}
      />
      <Text className="text-sm text-neutral-500">No account yet? The code creates one.</Text>
    </View>
  )
}

function CodeStep({
  auth,
  email,
  wait,
  resend,
  onSignedIn,
  onChangeAddress,
}: {
  auth: Auth
  email: string
  wait: number
  resend: () => Promise<boolean>
  onSignedIn: () => void
  onChangeAddress: () => void
}) {
  const queryClient = useQueryClient()
  const [resent, setResent] = useState(false)
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    mode: 'onTouched',
    defaultValues: { code: '' },
  })
  const { errors, isSubmitting } = form.formState

  async function onSubmit(values: CodeValues) {
    try {
      await auth.signInWithCode({ email, code: values.code })
    } catch (error) {
      applyServerError(error, ['code'], form.setError)
      return
    }

    await queryClient.invalidateQueries({ queryKey: sessionQuery(auth).queryKey })
    onSignedIn()
  }

  async function sendAgain() {
    setResent(!(await resend()))
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
      <Button label="Sign in" disabled={isSubmitting} onPress={form.handleSubmit(onSubmit)} />
      <Button
        label={wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        variant="outline"
        disabled={wait > 0}
        onPress={sendAgain}
      />
      {resent ? (
        <Text accessibilityRole="text" className="text-sm text-neutral-500">
          A new code is on its way. The previous one no longer works.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Use another email"
        onPress={onChangeAddress}
      >
        <Text className="text-sm text-neutral-900 underline">Use another email</Text>
      </Pressable>
    </View>
  )
}
